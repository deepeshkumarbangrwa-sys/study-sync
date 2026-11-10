"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import {
  createProjectForUser, createProjectTaskForUser, updateProjectTaskForUser,
  setProjectTaskCompletedForUser, deleteProjectTaskForUser, postProjectMessageForUser,
  createProjectInvitationForUser, revokeProjectInvitationForUser, joinProjectForUser,
  requestTaskExtensionForUser, decideTaskExtensionForUser,
} from "@/lib/projects"
import {
  ProjectError, type ProjectActionResult, type ProjectInput, type ProjectTaskInput,
  type ProjectMessageInput, type ExtensionRequestInput,
} from "@/lib/project-validation"

async function run<T>(operation: (userId: string) => Promise<T>): Promise<ProjectActionResult<T>> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { ok: false, error: "Your session has expired. Sign in again to continue." }
    const data = await operation(session.user.id)
    revalidatePath("/")
    revalidatePath("/projects", "layout")
    return { ok: true, data }
  } catch (error) {
    if (error instanceof ProjectError) return { ok: false, error: error.message }
    console.error("StudySync could not save a project change.", error instanceof Error ? error.name : "UnknownError")
    return { ok: false, error: "We couldn't save that change. Please try again." }
  }
}

export async function createProject(input: ProjectInput) {
  return run((userId) => createProjectForUser(userId, input))
}
export async function createProjectTask(projectId: string, input: ProjectTaskInput) {
  return run((userId) => createProjectTaskForUser(userId, projectId, input))
}
export async function updateProjectTask(projectId: string, taskId: string, input: ProjectTaskInput) {
  return run((userId) => updateProjectTaskForUser(userId, projectId, taskId, input))
}
export async function setProjectTaskCompleted(projectId: string, taskId: string, completed: boolean) {
  return run((userId) => setProjectTaskCompletedForUser(userId, projectId, taskId, completed))
}
export async function deleteProjectTask(projectId: string, taskId: string) {
  return run((userId) => deleteProjectTaskForUser(userId, projectId, taskId))
}
export async function postProjectMessage(projectId: string, input: ProjectMessageInput) {
  return run((userId) => postProjectMessageForUser(userId, projectId, input))
}
export async function createProjectInvitation(projectId: string) {
  return run((userId) => createProjectInvitationForUser(userId, projectId))
}
export async function revokeProjectInvitation(projectId: string) {
  return run((userId) => revokeProjectInvitationForUser(userId, projectId))
}
export async function joinProject(token: string) {
  return run((userId) => joinProjectForUser(userId, token))
}
export async function requestTaskExtension(projectId: string, taskId: string, input: ExtensionRequestInput) {
  return run((userId) => requestTaskExtensionForUser(userId, projectId, taskId, input))
}
export async function decideTaskExtension(projectId: string, requestId: string, approve: boolean) {
  return run((userId) => decideTaskExtensionForUser(userId, projectId, requestId, approve))
}
