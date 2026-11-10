import { Prisma, type StudySession, type Task } from "@prisma/client"
import { prisma } from "./prisma"
import {
  FOCUS_DURATION_SECONDS,
  PlannerError,
  parseRecordId,
  parseTaskInput,
  utcWeekBounds,
  type DashboardData,
  type FocusSession,
  type TaskItem,
} from "./planner-validation"

// This module is a server-side data layer. Its userId must come from auth(),
// never from a browser request; the action wrappers enforce that boundary.
function taskItem(task: Task): TaskItem {
  return {
    id: task.id,
    title: task.title,
    module: task.module,
    dueDate: task.dueDate,
    completed: task.completed,
    createdAt: task.createdAt.toISOString(),
  }
}

function focusSession(session: StudySession): FocusSession {
  return {
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    durationSeconds: session.durationSeconds,
  }
}

export async function getDashboard(userId: string): Promise<DashboardData> {
  const { start, end } = utcWeekBounds(new Date())
  const [tasks, activeSession, completedStudy] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
    }),
    prisma.studySession.findFirst({
      where: { userId, activeUserId: userId, completedAt: null, abandonedAt: null },
    }),
    prisma.studySession.aggregate({
      where: { userId, completedAt: { gte: start, lt: end }, abandonedAt: null },
      _sum: { durationSeconds: true },
    }),
  ])

  const pending = tasks.filter((task) => !task.completed)
  return {
    tasks: tasks.map(taskItem),
    activeSession: activeSession ? focusSession(activeSession) : null,
    pendingTasks: pending.length,
    studyMinutesThisWeek: Math.floor((completedStudy._sum.durationSeconds ?? 0) / 60),
    activeModules: new Set(
      pending.map((task) => task.module?.toLowerCase()).filter(Boolean),
    ).size,
  }
}

export async function createTaskForUser(userId: string, input: unknown) {
  const data = parseTaskInput(input)
  return taskItem(await prisma.task.create({ data: { ...data, userId } }))
}

export async function updateTaskForUser(userId: string, taskId: unknown, input: unknown) {
  const id = parseRecordId(taskId)
  const data = parseTaskInput(input)
  const result = await prisma.task.updateMany({ where: { id, userId }, data })
  if (!result.count) throw new PlannerError("Task not found. Refresh and try again.")
  const task = await prisma.task.findFirst({ where: { id, userId } })
  if (!task) throw new PlannerError("Task not found. Refresh and try again.")
  return taskItem(task)
}

export async function setTaskCompletedForUser(userId: string, taskId: unknown, completed: unknown) {
  const id = parseRecordId(taskId)
  if (typeof completed !== "boolean") throw new PlannerError("Choose a valid task status.")
  const result = await prisma.task.updateMany({ where: { id, userId }, data: { completed } })
  if (!result.count) throw new PlannerError("Task not found. Refresh and try again.")
  const task = await prisma.task.findFirst({ where: { id, userId } })
  if (!task) throw new PlannerError("Task not found. Refresh and try again.")
  return taskItem(task)
}

export async function deleteTaskForUser(userId: string, taskId: unknown) {
  const id = parseRecordId(taskId)
  const result = await prisma.task.deleteMany({ where: { id, userId } })
  if (!result.count) throw new PlannerError("Task not found. Refresh and try again.")
}

export async function startStudySessionForUser(userId: string): Promise<FocusSession> {
  const existing = await prisma.studySession.findUnique({ where: { activeUserId: userId } })
  if (existing) return focusSession(existing)

  try {
    return focusSession(await prisma.studySession.create({
      data: { userId, activeUserId: userId, durationSeconds: FOCUS_DURATION_SECONDS },
    }))
  } catch (error) {
    // Concurrent starts are resolved by the unique activeUserId constraint.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const active = await prisma.studySession.findUnique({ where: { activeUserId: userId } })
      if (active) return focusSession(active)
    }
    throw error
  }
}

export async function abandonStudySessionForUser(userId: string, sessionId: unknown) {
  const id = parseRecordId(sessionId)
  const session = await prisma.studySession.findFirst({ where: { id, userId } })
  if (!session) throw new PlannerError("Study session not found. Refresh and try again.")
  if (session.completedAt) throw new PlannerError("This session has already been saved.")
  if (session.abandonedAt) return

  const result = await prisma.studySession.updateMany({
    where: { id, userId, completedAt: null, abandonedAt: null },
    data: { abandonedAt: new Date(), activeUserId: null },
  })
  if (!result.count) throw new PlannerError("This session has already changed. Refresh and try again.")
}

export async function completeStudySessionForUser(userId: string, sessionId: unknown) {
  const id = parseRecordId(sessionId)
  const session = await prisma.studySession.findFirst({ where: { id, userId } })
  if (!session) throw new PlannerError("Study session not found. Refresh and try again.")
  if (session.completedAt) return { alreadyCompleted: true }
  if (session.abandonedAt) throw new PlannerError("This session was reset. Start a new session.")

  const now = new Date()
  if (now.getTime() - session.startedAt.getTime() < session.durationSeconds * 1000) {
    throw new PlannerError("Your focus block is still running. Wait until the timer finishes.")
  }

  const result = await prisma.studySession.updateMany({
    where: { id, userId, completedAt: null, abandonedAt: null },
    data: { completedAt: now, activeUserId: null },
  })
  if (!result.count) {
    const latest = await prisma.studySession.findFirst({ where: { id, userId } })
    if (latest?.completedAt) return { alreadyCompleted: true }
    throw new PlannerError("This session was reset. Start a new session.")
  }
  return { alreadyCompleted: false }
}
