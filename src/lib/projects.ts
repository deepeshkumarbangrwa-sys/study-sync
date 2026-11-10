import { createHash, randomBytes } from "node:crypto"
import { Prisma, type ProjectTask, type TaskExtensionRequest } from "@prisma/client"
import { prisma } from "./prisma"
import {
  ProjectError,
  parseExtensionRequestInput,
  parseInvitationToken,
  parseProjectInput,
  parseProjectMessageInput,
  parseProjectTaskInput,
  projectRecordId,
  type AssignedProjectTask,
  type ExtensionRequestItem,
  type InvitationPreview,
  type ProjectDetail,
  type ProjectPriority,
  type ProjectSummary,
  type ProjectTaskItem,
} from "./project-validation"

type Database = Prisma.TransactionClient
const notFound = () => new ProjectError("Project not found, or you no longer have access.")
const invalidInvitation = () => new ProjectError("This invitation is invalid or has expired. Ask the project owner for a new link.")

// Service user IDs are supplied by authenticated server actions, never browser input.
async function membership(db: Database, userId: string, projectId: unknown) {
  const id = projectRecordId(projectId)
  const project = await db.project.findFirst({
    where: { id, members: { some: { userId } } },
    select: { id: true, ownerId: true },
  })
  if (!project) throw notFound()
  return project
}

async function ownership(db: Database, userId: string, projectId: unknown) {
  const project = await membership(db, userId, projectId)
  if (project.ownerId !== userId) throw new ProjectError("Only the project owner can make this change.")
  return project
}

function taskItem(task: ProjectTask): ProjectTaskItem {
  return {
    id: task.id, title: task.title, details: task.details,
    priority: task.priority as ProjectPriority, dueDate: task.dueDate,
    assigneeId: task.assigneeId, createdById: task.createdById,
    completed: task.completed, createdAt: task.createdAt.toISOString(),
  }
}

function extensionItem(request: TaskExtensionRequest): ExtensionRequestItem {
  return {
    id: request.id, taskId: request.taskId, requestedById: request.requestedById,
    requestedDate: request.requestedDate, reason: request.reason,
    status: request.status as ExtensionRequestItem["status"],
    createdAt: request.createdAt.toISOString(), decidedAt: request.decidedAt?.toISOString() ?? null,
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function getProjectsForUser(userId: string): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true, tasks: { where: { completed: false } } } } },
  })
  return projects.map((project) => ({
    id: project.id, name: project.name, description: project.description,
    ownerId: project.ownerId, memberCount: project._count.members, pendingTasks: project._count.tasks,
  }))
}

export async function getProjectForUser(userId: string, projectId: string): Promise<ProjectDetail | null> {
  if (!projectId || projectId.length > 128) return null
  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    include: {
      members: { orderBy: { joinedAt: "asc" }, include: { user: { select: { name: true } } } },
      tasks: { orderBy: [{ completed: "asc" }, { createdAt: "desc" }] },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      invitation: { select: { expiresAt: true, revokedAt: true } },
      extensionRequests: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!project) return null
  return {
    id: project.id, name: project.name, description: project.description,
    ownerId: project.ownerId, memberCount: project.members.length,
    pendingTasks: project.tasks.filter((task) => !task.completed).length,
    createdAt: project.createdAt.toISOString(),
    members: project.members.map((member) => ({ userId: member.userId, name: member.user.name || "Team member" })),
    tasks: project.tasks.map(taskItem),
    messages: project.messages.map((message) => ({
      id: message.id, body: message.body, taskId: message.taskId, authorId: message.authorId,
      authorName: message.author.name || "Team member", createdAt: message.createdAt.toISOString(),
    })),
    extensionRequests: project.extensionRequests.map(extensionItem),
    activeInvitation: project.ownerId === userId && project.invitation && !project.invitation.revokedAt && project.invitation.expiresAt > new Date()
      ? { expiresAt: project.invitation.expiresAt.toISOString() } : null,
  }
}

export async function getAssignedTasksForUser(userId: string): Promise<AssignedProjectTask[]> {
  const tasks = await prisma.projectTask.findMany({
    where: { assigneeId: userId, project: { members: { some: { userId } } } },
    include: { project: { select: { name: true } } },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  })
  return tasks.map((task) => ({
    id: task.id, title: task.title, completed: task.completed,
    priority: task.priority as ProjectPriority, dueDate: task.dueDate,
    projectId: task.projectId, projectName: task.project.name,
  }))
}

export async function createProjectForUser(userId: string, input: unknown) {
  const data = parseProjectInput(input)
  return prisma.project.create({
    data: { ...data, ownerId: userId, members: { create: { userId } } },
    select: { id: true },
  })
}

async function validAssignee(db: Database, projectId: string, assigneeId: string | null) {
  if (assigneeId && !(await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: assigneeId } } }))) {
    throw new ProjectError("Assign tasks only to a member of this project.")
  }
}

export async function createProjectTaskForUser(userId: string, projectId: unknown, input: unknown) {
  const data = parseProjectTaskInput(input)
  return prisma.$transaction(async (db) => {
    const project = await ownership(db, userId, projectId)
    await validAssignee(db, project.id, data.assigneeId)
    return taskItem(await db.projectTask.create({ data: { ...data, projectId: project.id, createdById: userId } }))
  })
}

export async function updateProjectTaskForUser(userId: string, projectId: unknown, taskId: unknown, input: unknown) {
  const id = projectRecordId(taskId)
  const data = parseProjectTaskInput(input)
  return prisma.$transaction(async (db) => {
    const project = await ownership(db, userId, projectId)
    await validAssignee(db, project.id, data.assigneeId)
    const result = await db.projectTask.updateMany({ where: { id, projectId: project.id }, data })
    if (!result.count) throw new ProjectError("Task not found in this project.")
    return taskItem(await db.projectTask.findUniqueOrThrow({ where: { id } }))
  })
}

export async function setProjectTaskCompletedForUser(userId: string, projectId: unknown, taskId: unknown, completed: unknown) {
  if (typeof completed !== "boolean") throw new ProjectError("Choose a valid task status.")
  const id = projectRecordId(taskId)
  return prisma.$transaction(async (db) => {
    const project = await membership(db, userId, projectId)
    const task = await db.projectTask.findFirst({ where: { id, projectId: project.id } })
    if (!task) throw new ProjectError("Task not found in this project.")
    if (project.ownerId !== userId && task.assigneeId !== userId) {
      throw new ProjectError("Only the assignee or project owner can change this task's status.")
    }
    return taskItem(await db.projectTask.update({ where: { id }, data: { completed } }))
  })
}

export async function deleteProjectTaskForUser(userId: string, projectId: unknown, taskId: unknown) {
  const id = projectRecordId(taskId)
  return prisma.$transaction(async (db) => {
    const project = await ownership(db, userId, projectId)
    const result = await db.projectTask.deleteMany({ where: { id, projectId: project.id } })
    if (!result.count) throw new ProjectError("Task not found in this project.")
  })
}

export async function postProjectMessageForUser(userId: string, projectId: unknown, input: unknown) {
  const data = parseProjectMessageInput(input)
  return prisma.$transaction(async (db) => {
    const project = await membership(db, userId, projectId)
    if (data.taskId && !(await db.projectTask.findFirst({ where: { id: data.taskId, projectId: project.id } }))) {
      throw new ProjectError("Task not found in this project.")
    }
    const message = await db.projectMessage.create({
      data: { ...data, projectId: project.id, authorId: userId },
      include: { author: { select: { name: true } } },
    })
    return {
      id: message.id, body: message.body, taskId: message.taskId,
      authorId: userId, authorName: message.author.name || "Team member",
      createdAt: message.createdAt.toISOString(),
    }
  })
}

export async function createProjectInvitationForUser(userId: string, projectId: unknown) {
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.$transaction(async (db) => {
    const project = await ownership(db, userId, projectId)
    const data = { tokenHash: tokenHash(token), expiresAt, revokedAt: null, createdAt: new Date() }
    await db.projectInvitation.upsert({ where: { projectId: project.id }, create: { ...data, projectId: project.id }, update: data })
  })
  return { token, expiresAt: expiresAt.toISOString() }
}

export async function revokeProjectInvitationForUser(userId: string, projectId: unknown) {
  await prisma.$transaction(async (db) => {
    const project = await ownership(db, userId, projectId)
    await db.projectInvitation.updateMany({ where: { projectId: project.id }, data: { revokedAt: new Date() } })
  })
}

export async function previewInvitationForUser(userId: string, rawToken: unknown): Promise<InvitationPreview | null> {
  let token: string
  try { token = parseInvitationToken(rawToken) } catch { return null }
  const invite = await prisma.projectInvitation.findFirst({
    where: { tokenHash: tokenHash(token), revokedAt: null, expiresAt: { gt: new Date() } },
    include: { project: { select: { name: true, members: { where: { userId }, select: { userId: true } } } } },
  })
  if (!invite) return null
  return { projectId: invite.projectId, projectName: invite.project.name, expiresAt: invite.expiresAt.toISOString(), alreadyMember: invite.project.members.length > 0 }
}

export async function joinProjectForUser(userId: string, rawToken: unknown) {
  const token = parseInvitationToken(rawToken)
  return prisma.$transaction(async (db) => {
    const invite = await db.projectInvitation.findFirst({
      where: { tokenHash: tokenHash(token), revokedAt: null, expiresAt: { gt: new Date() } },
    })
    if (!invite) throw invalidInvitation()
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId: invite.projectId, userId } },
      create: { projectId: invite.projectId, userId }, update: {},
    })
    return { projectId: invite.projectId }
  })
}

export async function requestTaskExtensionForUser(userId: string, projectId: unknown, taskId: unknown, input: unknown) {
  const id = projectRecordId(taskId)
  const data = parseExtensionRequestInput(input)
  try {
    return await prisma.$transaction(async (db) => {
      const project = await membership(db, userId, projectId)
      const task = await db.projectTask.findFirst({ where: { id, projectId: project.id } })
      if (!task) throw new ProjectError("Task not found in this project.")
      if (task.assigneeId !== userId) throw new ProjectError("Only the assigned student can request more time.")
      if (task.completed) throw new ProjectError("Completed tasks do not need a deadline extension.")
      if (!task.dueDate) throw new ProjectError("Ask the project owner to set a deadline first.")
      if (data.requestedDate <= task.dueDate || data.requestedDate < new Date().toISOString().slice(0, 10)) {
        throw new ProjectError("Choose a new date after the current deadline and no earlier than today (UTC).")
      }
      return extensionItem(await db.taskExtensionRequest.create({
        data: { ...data, projectId: project.id, taskId: id, requestedById: userId, pendingTaskId: id },
      }))
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ProjectError("This task already has a pending extension request.")
    }
    throw error
  }
}

export async function decideTaskExtensionForUser(userId: string, projectId: unknown, requestId: unknown, approve: unknown) {
  if (typeof approve !== "boolean") throw new ProjectError("Choose approve or reject.")
  const id = projectRecordId(requestId)
  return prisma.$transaction(async (db) => {
    const project = await ownership(db, userId, projectId)
    const request = await db.taskExtensionRequest.findFirst({ where: { id, projectId: project.id }, include: { task: true } })
    if (!request) throw new ProjectError("Extension request not found.")
    if (request.status !== "PENDING") throw new ProjectError("This request has already been decided.")
    if (approve) {
      const task = request.task
      if (task.completed || task.assigneeId !== request.requestedById || !task.dueDate || request.requestedDate <= task.dueDate) {
        throw new ProjectError("This task has changed. Reject this request and ask for a new one if needed.")
      }
      await db.projectTask.update({ where: { id: task.id }, data: { dueDate: request.requestedDate } })
    }
    return extensionItem(await db.taskExtensionRequest.update({
      where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", pendingTaskId: null, decidedAt: new Date(), decidedById: userId },
    }))
  })
}
