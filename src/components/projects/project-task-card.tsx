"use client"

import { useState } from "react"
import { decideTaskExtension, deleteProjectTask, requestTaskExtension, setProjectTaskCompleted } from "@/app/projects/actions"
import type { ProjectDetail, ProjectTaskItem } from "@/lib/project-validation"
import { ProjectDiscussion } from "./project-discussion"
import { Feedback, displayDate, inputClass, primaryButton, secondaryButton } from "./ui"
import { useProjectAction } from "./use-project-action"

export function ProjectTaskCard({ project, task, currentUserId, today, onEdit, onDeleted }: { project: ProjectDetail; task: ProjectTaskItem; currentUserId: string; today: string; onEdit: () => void; onDeleted: () => void }) {
  const owner = project.ownerId === currentUserId
  const assignee = task.assigneeId === currentUserId
  const canComplete = owner || assignee
  const [details, setDetails] = useState(false)
  const [extensionForm, setExtensionForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { run, pending, error, success } = useProjectAction()
  const extensions = project.extensionRequests.filter(request => request.taskId === task.id)
  const outstanding = extensions.some(request => request.status === "PENDING")
  const assignedName = project.members.find(member => member.userId === task.assigneeId)?.name
  const comments = project.messages.filter(message => message.taskId === task.id)
  const priorityStyle = task.priority === "HIGH" ? "bg-rose-50 text-rose-700" : task.priority === "LOW" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"

  return <li id={`project-task-${task.id}`} className="scroll-mt-6 py-5">
    <div className="flex items-start gap-3">
      <input type="checkbox" checked={task.completed} disabled={!canComplete || pending} aria-label={`Mark ${task.title} as ${task.completed ? "open" : "completed"}`} onChange={event => { const checked = event.currentTarget.checked; run(() => setProjectTaskCompleted(project.id, task.id, checked), undefined, checked ? "Task completed." : "Task reopened.") }} className="mt-1 h-5 w-5 shrink-0 accent-indigo-600 disabled:cursor-not-allowed" />
      <div className="min-w-0 flex-1">
        <h3 className={`break-words text-sm font-semibold leading-6 ${task.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>{task.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs"><span className={`rounded-md px-2 py-1 font-medium ${priorityStyle}`}>{task.priority[0] + task.priority.slice(1).toLowerCase()} priority</span><span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">{assignedName || "Unassigned"}</span>{task.dueDate && <span className={`rounded-md px-2 py-1 ${!task.completed && task.dueDate < today ? "bg-red-50 font-medium text-red-700" : "bg-slate-100 text-slate-600"}`}>{!task.completed && task.dueDate < today ? "Overdue · " : "Due "}{displayDate(task.dueDate)}</span>}</div>
        {task.details && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{task.details}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium">
          <button onClick={() => setDetails(!details)} aria-expanded={details} className="text-indigo-700 hover:underline">{details ? "Hide feedback" : `Feedback (${comments.length})`}</button>
          {!task.completed && assignee && !outstanding && <button onClick={() => setExtensionForm(!extensionForm)} disabled={pending} aria-expanded={extensionForm} className="text-indigo-700 hover:underline">Request more time</button>}
          {owner && <><button onClick={onEdit} disabled={pending} className="text-indigo-700 hover:underline">Edit<span className="sr-only"> {task.title}</span></button><button onClick={() => setConfirmDelete(true)} disabled={pending} className="text-slate-500 hover:text-red-700 hover:underline">Delete<span className="sr-only"> {task.title}</span></button></>}
        </div>
      </div>
    </div>
    {confirmDelete && <div className="mt-4 rounded-lg bg-red-50 p-4"><p className="text-sm text-red-900">Delete this task and its feedback? This cannot be undone.</p><div className="mt-3 flex gap-2"><button disabled={pending} onClick={() => run(() => deleteProjectTask(project.id, task.id), onDeleted)} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white">{pending ? "Deleting…" : "Delete task"}</button><button disabled={pending} onClick={() => setConfirmDelete(false)} className={secondaryButton}>Keep task</button></div></div>}
    {extensionForm && assignee && !task.completed && !outstanding && <form onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      run(() => requestTaskExtension(project.id, task.id, { requestedDate: String(data.get("requestedDate") || ""), reason: String(data.get("reason") || "") }), () => setExtensionForm(false), "Extension request sent to the project admin.")
    }} className="mt-4 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
      <h4 className="text-sm font-semibold">Request a new deadline</h4><p className="mt-1 text-xs leading-5 text-slate-500">Your deadline stays the same until the project admin approves.</p>
      <fieldset disabled={pending} className="mt-3 space-y-3"><label className="block text-sm font-medium">Requested date<input type="date" name="requestedDate" required min={today} max="9999-12-31" className={inputClass} /></label><label className="block text-sm font-medium">Reason<textarea name="reason" required maxLength={1000} rows={2} className={inputClass} /></label><div className="flex gap-2"><button className={primaryButton}>{pending ? "Sending…" : "Send request"}</button><button className={secondaryButton} type="button" onClick={() => setExtensionForm(false)}>Cancel</button></div></fieldset>
    </form>}
    {extensions.length > 0 && <ul className="mt-4 space-y-2">{extensions.map(request => <li key={request.id} className={`rounded-lg border p-3 ${request.status === "PENDING" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><p className="text-xs font-semibold text-slate-700">{project.members.find(member => member.userId === request.requestedById)?.name || "Team member"} requested {displayDate(request.requestedDate)} · {request.status.toLowerCase()}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{request.reason}</p>{owner && request.status === "PENDING" && <div className="mt-3 flex flex-wrap gap-2"><button disabled={pending} onClick={() => run(() => decideTaskExtension(project.id, request.id, true), undefined, "Extension approved. The task deadline has been updated.")} className={primaryButton}>Approve extension</button><button disabled={pending} onClick={() => run(() => decideTaskExtension(project.id, request.id, false), undefined, "Extension declined. The task deadline is unchanged.")} className={secondaryButton}>Decline extension</button></div>}</li>)}</ul>}
    <Feedback error={error} success={success} />
    {details && <div className="mt-4"><ProjectDiscussion projectId={project.id} messages={project.messages} taskId={task.id} /></div>}
  </li>
}
