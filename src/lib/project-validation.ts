export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const
export type ProjectPriority = typeof PROJECT_PRIORITIES[number]

export type ProjectInput = { name: string; description?: string }
export type ProjectTaskInput = {
  title: string
  details?: string
  priority: ProjectPriority
  dueDate?: string
  assigneeId?: string
}
export type ProjectMessageInput = { body: string; taskId?: string }
export type ExtensionRequestInput = { requestedDate: string; reason: string }
export type ExtensionRequestItem = {
  id: string
  taskId: string
  requestedById: string
  requestedDate: string
  reason: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  createdAt: string
  decidedAt: string | null
}
export type AssignedProjectTask = {
  id: string
  title: string
  completed: boolean
  priority: ProjectPriority
  dueDate: string | null
  projectId: string
  projectName: string
}

export type ProjectSummary = {
  id: string
  name: string
  description: string | null
  ownerId: string
  memberCount: number
  pendingTasks: number
}
export type ProjectTaskItem = {
  id: string
  title: string
  details: string | null
  priority: ProjectPriority
  dueDate: string | null
  assigneeId: string | null
  createdById: string
  completed: boolean
  createdAt: string
}
export type ProjectMessageItem = {
  id: string
  body: string
  taskId: string | null
  authorId: string
  authorName: string
  createdAt: string
}
export type ProjectDetail = ProjectSummary & {
  createdAt: string
  members: { userId: string; name: string }[]
  tasks: ProjectTaskItem[]
  messages: ProjectMessageItem[]
  extensionRequests: ExtensionRequestItem[]
  activeInvitation: { expiresAt: string } | null
}
export type InvitationPreview = {
  projectId: string
  projectName: string
  expiresAt: string
  alreadyMember: boolean
}
export type ProjectActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export class ProjectError extends Error {}

function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ProjectError("Enter valid project details.")
  }
  return input as Record<string, unknown>
}

function textValue(value: unknown, label: string, maximum: number, required = false) {
  if (value == null && !required) return null
  if (typeof value !== "string") throw new ProjectError(`Enter a valid ${label}.`)
  const text = value.trim()
  if ((!text && required) || text.length > maximum) {
    throw new ProjectError(`${label[0].toUpperCase() + label.slice(1)} must contain ${required ? "1–" : "no more than "}${maximum} characters.`)
  }
  return text || null
}

export function projectRecordId(value: unknown) {
  const id = textValue(value, "item identifier", 128, true)
  return id as string
}

export function parseProjectInput(input: unknown) {
  const values = objectInput(input)
  return {
    name: textValue(values.name, "project name", 100, true) as string,
    description: textValue(values.description, "project description", 1000),
  }
}

export function parseProjectTaskInput(input: unknown) {
  const values = objectInput(input)
  const title = textValue(values.title, "task title", 200, true) as string
  const details = textValue(values.details, "task details", 2000)
  const priority = values.priority
  if (!PROJECT_PRIORITIES.includes(priority as ProjectPriority)) {
    throw new ProjectError("Choose a low, medium, or high priority.")
  }
  const dueDate = textValue(values.dueDate, "due date", 10)
  if (dueDate) {
    const date = new Date(`${dueDate}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dueDate) {
      throw new ProjectError("Enter a real due date in YYYY-MM-DD format.")
    }
  }
  const assigneeId = textValue(values.assigneeId, "assignee", 128)
  return { title, details, priority: priority as ProjectPriority, dueDate, assigneeId }
}

export function parseProjectMessageInput(input: unknown) {
  const values = objectInput(input)
  return {
    body: textValue(values.body, "message", 2000, true) as string,
    taskId: textValue(values.taskId, "task identifier", 128),
  }
}

export function parseInvitationToken(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new ProjectError("This invitation is invalid or has expired. Ask the project owner for a new link.")
  }
  return value
}

export function parseExtensionRequestInput(input: unknown) {
  const values = objectInput(input)
  const requestedDate = textValue(values.requestedDate, "requested date", 10, true) as string
  const date = new Date(`${requestedDate}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== requestedDate) {
    throw new ProjectError("Enter a real requested date in YYYY-MM-DD format.")
  }
  return {
    requestedDate,
    reason: textValue(values.reason, "reason", 1000, true) as string,
  }
}
