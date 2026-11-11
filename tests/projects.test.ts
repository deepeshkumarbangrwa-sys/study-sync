import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createHash, randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import { resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { prisma } from "../src/lib/prisma"
import {
  createProjectForUser, createProjectInvitationForUser, createProjectTaskForUser,
  decideTaskExtensionForUser, deleteProjectTaskForUser, getAssignedTasksForUser,
  getProjectForUser, getProjectsForUser, joinProjectForUser, postProjectMessageForUser,
  previewInvitationForUser, requestTaskExtensionForUser, revokeProjectInvitationForUser,
  setProjectTaskCompletedForUser, updateProjectTaskForUser,
} from "../src/lib/projects"
import { ProjectError } from "../src/lib/project-validation"

before(() => {
  assert.equal(process.env.STUDYSYNC_TEST_DATABASE, "1", "Run tests with npm test.")
  const database = fileURLToPath(process.env.DATABASE_URL ?? "")
  assert.ok(resolve(database).startsWith(`${resolve(tmpdir())}${sep}studysync-test-`))
  assert.ok(database.endsWith(`${sep}test.db`))
})

after(async () => { await prisma.$disconnect() })

function dateAfter(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function user(name = "Test student") {
  return prisma.user.create({ data: { name, email: `${randomUUID()}@example.test` } })
}

async function team() {
  const owner = await user("Project owner")
  const member = await user("Assigned student")
  const outsider = await user("Other student")
  const project = await createProjectForUser(owner.id, { name: "Secure project", ownerId: outsider.id })
  const invitation = await createProjectInvitationForUser(owner.id, project.id)
  await joinProjectForUser(member.id, invitation.token)
  return { owner, member, outsider, project, invitation }
}

test("project creation fixes ownership to the authenticated user and hides it from nonmembers", async () => {
  const { owner, member, outsider, project } = await team()
  assert.equal((await getProjectForUser(owner.id, project.id))?.ownerId, owner.id)
  assert.equal((await getProjectForUser(member.id, project.id))?.memberCount, 2)
  assert.equal(await getProjectForUser(outsider.id, project.id), null)
  assert.deepEqual(await getProjectsForUser(outsider.id), [])
  assert.equal((await getProjectsForUser(member.id))[0].id, project.id)
  await assert.rejects(postProjectMessageForUser(outsider.id, project.id, { body: "Unauthorized" }), ProjectError)
  await assert.rejects(createProjectInvitationForUser(outsider.id, project.id), ProjectError)
})

test("only owners can create, assign, edit, and delete shared tasks", async () => {
  const { owner, member, outsider, project } = await team()
  const input = { title: "Read sources", priority: "HIGH", assigneeId: member.id, dueDate: dateAfter(1) }
  await assert.rejects(createProjectTaskForUser(member.id, project.id, input), /Only the project owner/)
  await assert.rejects(createProjectTaskForUser(outsider.id, project.id, input), ProjectError)
  await assert.rejects(createProjectTaskForUser(owner.id, project.id, { ...input, assigneeId: outsider.id }), /member of this project/)
  const task = await createProjectTaskForUser(owner.id, project.id, { ...input, createdById: outsider.id, completed: true })
  assert.equal(task.createdById, owner.id)
  assert.equal(task.completed, false)
  await assert.rejects(updateProjectTaskForUser(member.id, project.id, task.id, { ...input, title: "Unauthorized" }), ProjectError)
  await assert.rejects(deleteProjectTaskForUser(member.id, project.id, task.id), ProjectError)
  await assert.rejects(updateProjectTaskForUser(owner.id, project.id, task.id, { ...input, assigneeId: outsider.id }), ProjectError)
  const edited = await updateProjectTaskForUser(owner.id, project.id, task.id, { ...input, title: "Review sources", priority: "LOW" })
  assert.equal(edited.title, "Review sources")
  assert.equal(edited.priority, "LOW")
  await deleteProjectTaskForUser(owner.id, project.id, task.id)
  assert.equal(await prisma.projectTask.findUnique({ where: { id: task.id } }), null)
})

test("only the assignee or owner can complete a task and assignments appear only to that assignee", async () => {
  const { owner, member, outsider, project, invitation } = await team()
  await joinProjectForUser(outsider.id, invitation.token)
  const task = await createProjectTaskForUser(owner.id, project.id, { title: "Assigned work", priority: "MEDIUM", assigneeId: member.id })
  assert.equal((await getAssignedTasksForUser(member.id))[0].id, task.id)
  assert.deepEqual(await getAssignedTasksForUser(outsider.id), [])
  await assert.rejects(setProjectTaskCompletedForUser(outsider.id, project.id, task.id, true), /assignee or project owner/)
  await assert.rejects(setProjectTaskCompletedForUser(member.id, project.id, task.id, "true"), ProjectError)
  assert.equal((await setProjectTaskCompletedForUser(member.id, project.id, task.id, true)).completed, true)
  assert.equal((await setProjectTaskCompletedForUser(owner.id, project.id, task.id, false)).completed, false)
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId: project.id, userId: member.id } } })
  assert.deepEqual(await getAssignedTasksForUser(member.id), [])
  await assert.rejects(setProjectTaskCompletedForUser(member.id, project.id, task.id, true), ProjectError)
})

test("invitations store only hashes, require owner management, and joining is idempotent", async () => {
  const { owner, member, outsider, project, invitation } = await team()
  const saved = await prisma.projectInvitation.findUniqueOrThrow({ where: { projectId: project.id } })
  assert.match(invitation.token, /^[a-f0-9]{64}$/)
  assert.notEqual(saved.tokenHash, invitation.token)
  assert.equal(saved.tokenHash, createHash("sha256").update(invitation.token).digest("hex"))
  assert.equal("tokenHash" in (await getProjectForUser(owner.id, project.id))!, false)
  assert.equal((await getProjectForUser(member.id, project.id))?.activeInvitation, null)
  assert.equal((await previewInvitationForUser(outsider.id, invitation.token))?.alreadyMember, false)
  await joinProjectForUser(outsider.id, invitation.token)
  await joinProjectForUser(outsider.id, invitation.token)
  assert.equal(await prisma.projectMember.count({ where: { projectId: project.id, userId: outsider.id } }), 1)
  assert.equal((await previewInvitationForUser(outsider.id, invitation.token))?.alreadyMember, true)
  await assert.rejects(createProjectInvitationForUser(member.id, project.id), ProjectError)
  await assert.rejects(revokeProjectInvitationForUser(member.id, project.id), ProjectError)
})

test("expired, revoked, and replaced invitations cannot admit users", async () => {
  const { owner, outsider, project, invitation } = await team()
  await prisma.projectInvitation.update({ where: { projectId: project.id }, data: { expiresAt: new Date(Date.now() - 1) } })
  assert.equal(await previewInvitationForUser(outsider.id, invitation.token), null)
  await assert.rejects(joinProjectForUser(outsider.id, invitation.token), /expired/)
  const replacement = await createProjectInvitationForUser(owner.id, project.id)
  await assert.rejects(joinProjectForUser(outsider.id, invitation.token), /expired/)
  await revokeProjectInvitationForUser(owner.id, project.id)
  await assert.rejects(joinProjectForUser(outsider.id, replacement.token), /expired/)
  assert.equal(await previewInvitationForUser(outsider.id, "not-a-token"), null)
  assert.equal(await prisma.projectMember.count({ where: { projectId: project.id, userId: outsider.id } }), 0)
})

test("feedback belongs to a task in the same project and cannot impersonate its author", async () => {
  const { owner, member, outsider, project } = await team()
  const otherProject = await createProjectForUser(owner.id, { name: "Other project" })
  const otherTask = await createProjectTaskForUser(owner.id, otherProject.id, { title: "Private task", priority: "MEDIUM" })
  const task = await createProjectTaskForUser(owner.id, project.id, { title: "Shared task", priority: "MEDIUM" })
  await assert.rejects(postProjectMessageForUser(member.id, project.id, { body: "Wrong task", taskId: otherTask.id }), /Task not found/)
  await assert.rejects(postProjectMessageForUser(outsider.id, project.id, { body: "Outsider" }), ProjectError)
  const message = await postProjectMessageForUser(member.id, project.id, { body: "Useful feedback", taskId: task.id, authorId: owner.id })
  assert.equal(message.authorId, member.id)
  assert.equal(message.taskId, task.id)
  assert.equal((await postProjectMessageForUser(owner.id, project.id, { body: "Project discussion" })).taskId, null)
  assert.equal((await getProjectForUser(member.id, project.id))?.messages.length, 2)
})

test("invalid shared task and message inputs cannot be persisted", async () => {
  const { owner, project } = await team()
  for (const input of [
    { title: " ", priority: "LOW" },
    { title: "Work", priority: "URGENT" },
    { title: "Work", priority: "HIGH", dueDate: "2027-02-29" },
    { title: "Work", priority: "HIGH", assigneeId: 123 },
  ]) await assert.rejects(createProjectTaskForUser(owner.id, project.id, input), ProjectError)
  await assert.rejects(postProjectMessageForUser(owner.id, project.id, { body: " " }), ProjectError)
  await assert.rejects(postProjectMessageForUser(owner.id, project.id, { body: "x".repeat(4001) }), ProjectError)
  assert.equal(await prisma.projectTask.count({ where: { projectId: project.id } }), 0)
  assert.equal(await prisma.projectMessage.count({ where: { projectId: project.id } }), 0)
})

test("only the assignee requests extra time and only the owner decides it", async () => {
  const { owner, member, outsider, project, invitation } = await team()
  await joinProjectForUser(outsider.id, invitation.token)
  const dueDate = dateAfter(1)
  const task = await createProjectTaskForUser(owner.id, project.id, { title: "Research", priority: "HIGH", assigneeId: member.id, dueDate })
  const input = { requestedDate: dateAfter(3), reason: "Need to check more sources" }
  await assert.rejects(requestTaskExtensionForUser(outsider.id, project.id, task.id, input), /assigned student/)
  await assert.rejects(requestTaskExtensionForUser(member.id, project.id, task.id, { ...input, requestedDate: dueDate }), /after the current deadline/)
  const request = await requestTaskExtensionForUser(member.id, project.id, task.id, { ...input, status: "APPROVED", requestedById: owner.id })
  assert.equal(request.status, "PENDING")
  assert.equal(request.requestedById, member.id)
  assert.equal((await prisma.projectTask.findUniqueOrThrow({ where: { id: task.id } })).dueDate, dueDate)
  await assert.rejects(requestTaskExtensionForUser(member.id, project.id, task.id, input), /pending extension request/)
  await assert.rejects(decideTaskExtensionForUser(member.id, project.id, request.id, true), /Only the project owner/)
  await assert.rejects(decideTaskExtensionForUser(outsider.id, project.id, request.id, false), ProjectError)
  assert.equal((await decideTaskExtensionForUser(owner.id, project.id, request.id, true)).status, "APPROVED")
  assert.equal((await prisma.projectTask.findUniqueOrThrow({ where: { id: task.id } })).dueDate, input.requestedDate)
  await assert.rejects(decideTaskExtensionForUser(owner.id, project.id, request.id, false), /already been decided/)
})

test("rejecting an extension leaves the deadline unchanged and permits a new request", async () => {
  const { owner, member, project } = await team()
  const dueDate = dateAfter(1)
  const task = await createProjectTaskForUser(owner.id, project.id, { title: "Essay", priority: "MEDIUM", assigneeId: member.id, dueDate })
  const input = { requestedDate: dateAfter(2), reason: "Need more time" }
  const request = await requestTaskExtensionForUser(member.id, project.id, task.id, input)
  assert.equal((await decideTaskExtensionForUser(owner.id, project.id, request.id, false)).status, "REJECTED")
  assert.equal((await prisma.projectTask.findUniqueOrThrow({ where: { id: task.id } })).dueDate, dueDate)
  const nextRequest = await requestTaskExtensionForUser(member.id, project.id, task.id, input)
  assert.notEqual(nextRequest.id, request.id)
})

test("a changed assignment rolls back approval and leaves a stale request rejectable", async () => {
  const { owner, member, project } = await team()
  const input = { title: "Essay", priority: "MEDIUM", assigneeId: member.id, dueDate: dateAfter(1) }
  const task = await createProjectTaskForUser(owner.id, project.id, input)
  const request = await requestTaskExtensionForUser(member.id, project.id, task.id, { requestedDate: dateAfter(3), reason: "Need more time" })
  await updateProjectTaskForUser(owner.id, project.id, task.id, { ...input, assigneeId: owner.id })
  await assert.rejects(decideTaskExtensionForUser(owner.id, project.id, request.id, true), /task has changed/)
  const saved = await prisma.taskExtensionRequest.findUniqueOrThrow({ where: { id: request.id } })
  assert.equal(saved.status, "PENDING")
  assert.equal(saved.pendingTaskId, task.id)
  assert.equal((await prisma.projectTask.findUniqueOrThrow({ where: { id: task.id } })).dueDate, input.dueDate)
  assert.equal((await decideTaskExtensionForUser(owner.id, project.id, request.id, false)).status, "REJECTED")
})

test("concurrent extension decisions have one winner and a consistent task deadline", async () => {
  const { owner, member, project } = await team()
  const dueDate = dateAfter(1)
  const requestedDate = dateAfter(3)
  const task = await createProjectTaskForUser(owner.id, project.id, { title: "Concurrent review", priority: "LOW", assigneeId: member.id, dueDate })
  const request = await requestTaskExtensionForUser(member.id, project.id, task.id, { requestedDate, reason: "Need additional research" })
  const outcomes = await Promise.allSettled([
    decideTaskExtensionForUser(owner.id, project.id, request.id, true),
    decideTaskExtensionForUser(owner.id, project.id, request.id, false),
  ])
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1)
  const savedRequest = await prisma.taskExtensionRequest.findUniqueOrThrow({ where: { id: request.id } })
  const savedTask = await prisma.projectTask.findUniqueOrThrow({ where: { id: task.id } })
  assert.equal(savedRequest.pendingTaskId, null)
  assert.equal(savedRequest.decidedById, owner.id)
  assert.equal(savedTask.dueDate, savedRequest.status === "APPROVED" ? requestedDate : dueDate)
})
