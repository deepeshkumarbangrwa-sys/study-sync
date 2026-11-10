"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { postProjectMessage } from "@/app/projects/actions"
import type { ProjectMessageItem } from "@/lib/project-validation"
import { displayTimestamp, Feedback, inputClass, panelClass, primaryButton, secondaryButton } from "./ui"
import { useProjectAction } from "./use-project-action"

export function ProjectDiscussion({
  projectId,
  messages,
  taskId,
}: {
  projectId: string
  messages: ProjectMessageItem[]
  taskId?: string
}) {
  const headingId = useId()
  const inputId = useId()
  const router = useRouter()
  const [body, setBody] = useState("")
  const [refreshing, startRefresh] = useTransition()
  const { run, pending, error, success } = useProjectAction()
  const entries = messages
    .filter((message) => message.taskId === (taskId ?? null))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <section className={taskId ? "mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4" : panelClass} aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className={taskId ? "text-sm font-semibold" : "text-lg font-semibold"}>{taskId ? "Task feedback" : "Project discussion"}</h2>
        <button type="button" disabled={pending || refreshing} onClick={() => startRefresh(() => router.refresh())} className={secondaryButton}>
          {refreshing ? "Refreshing…" : "Refresh messages"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{taskId ? "Ask questions, share progress, or leave feedback about this task." : "Share progress, ask your team a question, or discuss your next steps."} Refresh to see new replies.</p>

      {entries.length ? (
        <ol className="mt-5 max-h-96 space-y-4 overflow-y-auto pr-1" aria-label={taskId ? "Task feedback messages" : "Project messages"}>
          {entries.map((message) => (
            <li key={message.id} className="rounded-xl border border-slate-100 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="break-words text-xs font-semibold text-slate-800">{message.authorName}</p>
                <time dateTime={message.createdAt} className="text-xs text-slate-400">{displayTimestamp(message.createdAt)} UTC</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{message.body}</p>
            </li>
          ))}
        </ol>
      ) : <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">{taskId ? "No feedback yet. Start the conversation below." : "No messages yet. Share an update with your team."}</p>}

      <form onSubmit={(event) => {
        event.preventDefault()
        run(
          () => postProjectMessage(projectId, { body, ...(taskId ? { taskId } : {}) }),
          () => setBody(""),
          taskId ? "Feedback posted." : "Message posted.",
        )
      }} className="mt-5">
        <fieldset disabled={pending}>
          <label htmlFor={inputId} className="text-sm font-medium">{taskId ? "Feedback message" : "Project message"}</label>
          <textarea id={inputId} name="body" required maxLength={2000} rows={3} value={body} onChange={(event) => setBody(event.currentTarget.value)} className={inputClass} placeholder={taskId ? "Share feedback or an update…" : "What would you like your team to know?"} />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">{body.length}/2000</p>
            <button type="submit" disabled={!body.trim()} className={primaryButton}>{pending ? "Posting…" : taskId ? "Post feedback" : "Post message"}</button>
          </div>
        </fieldset>
        <Feedback error={error} success={success} />
      </form>
    </section>
  )
}
