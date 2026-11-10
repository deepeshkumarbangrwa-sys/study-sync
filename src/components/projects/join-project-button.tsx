"use client"

import { useRouter } from "next/navigation"
import { joinProject } from "@/app/projects/actions"
import { Feedback, primaryButton } from "./ui"
import { useProjectAction } from "./use-project-action"

export function JoinProjectButton({ token }: { token: string }) {
  const router = useRouter()
  const { run, pending, error } = useProjectAction()
  return <>
    <button className={primaryButton} disabled={pending} onClick={() => run(() => joinProject(token), ({ projectId }) => router.push(`/projects/${projectId}`))}>{pending ? "Joining…" : "Join project"}</button>
    <Feedback error={error} />
  </>
}
