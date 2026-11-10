"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import {
  abandonStudySessionForUser,
  completeStudySessionForUser,
  createTaskForUser,
  deleteTaskForUser,
  setTaskCompletedForUser,
  startStudySessionForUser,
  updateTaskForUser,
} from "@/lib/planner"
import { PlannerError, type ActionResult, type TaskInput } from "@/lib/planner-validation"

async function runAction<T>(operation: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { ok: false, error: "Your session has expired. Sign in again to continue." }
    }
    const data = await operation(session.user.id)
    revalidatePath("/")
    return { ok: true, data }
  } catch (error) {
    if (error instanceof PlannerError) return { ok: false, error: error.message }
    console.error("StudySync could not save a planner change.", error instanceof Error ? error.name : "UnknownError")
    return { ok: false, error: "We couldn't save that change. Please try again." }
  }
}

export async function createTask(input: TaskInput) {
  return runAction((userId) => createTaskForUser(userId, input))
}

export async function updateTask(id: string, input: TaskInput) {
  return runAction((userId) => updateTaskForUser(userId, id, input))
}

export async function setTaskCompleted(id: string, completed: boolean) {
  return runAction((userId) => setTaskCompletedForUser(userId, id, completed))
}

export async function deleteTask(id: string) {
  return runAction((userId) => deleteTaskForUser(userId, id))
}

export async function startStudySession() {
  return runAction(startStudySessionForUser)
}

export async function abandonStudySession(id: string) {
  return runAction((userId) => abandonStudySessionForUser(userId, id))
}

export async function completeStudySession(id: string) {
  return runAction((userId) => completeStudySessionForUser(userId, id))
}
