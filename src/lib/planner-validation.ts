export const FOCUS_DURATION_SECONDS = 25 * 60

export type TaskInput = {
  title: string
  module?: string
  dueDate?: string
}

export type TaskItem = {
  id: string
  title: string
  module: string | null
  dueDate: string | null
  completed: boolean
  createdAt: string
}

export type FocusSession = {
  id: string
  startedAt: string
  durationSeconds: number
}

export type DashboardData = {
  tasks: TaskItem[]
  activeSession: FocusSession | null
  pendingTasks: number
  studyMinutesThisWeek: number
  activeModules: number
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export class PlannerError extends Error {}

export function parseTaskInput(input: unknown) {
  if (!input || typeof input !== "object") {
    throw new PlannerError("Enter a task title.")
  }

  const values = input as Record<string, unknown>
  if (typeof values.title !== "string") {
    throw new PlannerError("Enter a task title.")
  }
  const title = values.title.trim()
  if (!title || title.length > 200) {
    throw new PlannerError("Task titles must contain 1–200 characters.")
  }

  if (values.module != null && typeof values.module !== "string") {
    throw new PlannerError("Enter a valid module name.")
  }
  const moduleName = (values.module as string | undefined)?.trim() || null
  if (moduleName && moduleName.length > 80) {
    throw new PlannerError("Module names must contain no more than 80 characters.")
  }

  if (values.dueDate != null && typeof values.dueDate !== "string") {
    throw new PlannerError("Enter a valid due date.")
  }
  const dueDate = (values.dueDate as string | undefined)?.trim() || null
  if (dueDate) {
    const date = new Date(`${dueDate}T00:00:00.000Z`)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dueDate
    ) {
      throw new PlannerError("Enter a real date in YYYY-MM-DD format.")
    }
  }

  // Explicitly select editable fields: client-supplied userId/completed are ignored.
  return { title, module: moduleName, dueDate }
}

export function parseRecordId(id: unknown): string {
  if (typeof id !== "string" || !id.trim() || id.length > 128) {
    throw new PlannerError("This item could not be found. Refresh and try again.")
  }
  return id
}

export function utcWeekBounds(now: Date) {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return { start, end }
}
