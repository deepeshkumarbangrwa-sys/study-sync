"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createProjectTask, updateProjectTask } from "@/app/projects/actions"
import type { ProjectDetail, ProjectPriority, ProjectTaskItem } from "@/lib/project-validation"
import { ProjectDiscussion } from "./project-discussion"
import { ProjectInvitations } from "./project-invitations"
import { ProjectTaskCard } from "./project-task-card"
import { Feedback, displayDate, inputClass, panelClass, primaryButton, secondaryButton } from "./ui"
import { useProjectAction } from "./use-project-action"

type TaskFilter = "open" | "mine" | "completed" | "all"

export function ProjectWorkspace({ project, currentUserId, today }: { project: ProjectDetail; currentUserId: string; today: string }) {
  const router = useRouter()
  const owner = project.ownerId === currentUserId
  const [filter, setFilter] = useState<TaskFilter>("open")
  const [editor, setEditor] = useState<ProjectTaskItem | "new" | null>(null)
  const { run, pending, error, success } = useProjectAction()
  const openTasks = project.tasks.filter(task => !task.completed)
  const visibleTasks = project.tasks.filter(task => filter === "all" || (filter === "mine" ? task.assigneeId === currentUserId && !task.completed : task.completed === (filter === "completed")))
  const horizon = new Date(`${today}T00:00:00Z`)
  horizon.setUTCDate(horizon.getUTCDate() + 7)
  const until = horizon.toISOString().slice(0, 10)
  const reminders = openTasks.filter(task => task.assigneeId === currentUserId && task.dueDate && task.dueDate <= until).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))

  return <>
    <Link href="/projects" className="text-sm font-medium text-indigo-700 hover:underline">← All projects</Link>
    <header className="mb-7 mt-6 flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-600">Shared project · {owner ? "Project admin" : "Team member"}</p>
        <h1 className="break-words text-3xl font-bold tracking-tight">{project.name}</h1>
        {project.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{project.description}</p>}
      </div>
      <button className={secondaryButton} onClick={() => router.refresh()}>Refresh project</button>
    </header>
    <div className="mb-7 grid gap-3 sm:grid-cols-3">
      <Summary label="Open tasks" value={openTasks.length} />
      <Summary label="Completed tasks" value={project.tasks.length - openTasks.length} />
      <Summary label="Project members" value={project.members.length} />
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-3">
      <div className="min-w-0 space-y-6 xl:col-span-2">
        <section className={panelClass} aria-labelledby="project-tasks-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 id="project-tasks-heading" className="text-lg font-semibold">Project tasks</h2><p className="mt-1 text-sm text-slate-500">{owner ? "Assign the next steps and keep deadlines clear." : "See the plan, update your tasks, and share feedback."}</p></div>
            {owner && <button className={primaryButton} onClick={() => setEditor(editor === "new" ? null : "new")} aria-expanded={editor === "new"} disabled={pending}>+ Assign task</button>}
          </div>
          {editor && owner && <form key={editor === "new" ? "new" : editor.id} className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4" onSubmit={event => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const input = { title: String(data.get("title") || ""), details: String(data.get("details") || ""), priority: String(data.get("priority") || "MEDIUM") as ProjectPriority, dueDate: String(data.get("dueDate") || ""), assigneeId: String(data.get("assigneeId") || "") }
            const task = editor === "new" ? null : editor
            run(() => task ? updateProjectTask(project.id, task.id, input) : createProjectTask(project.id, input), () => setEditor(null), task ? "Task updated." : "Task assigned.")
          }}>
            <h3 className="mb-4 font-semibold">{editor === "new" ? "Assign a task" : "Edit task"}</h3>
            <fieldset disabled={pending} className="space-y-4">
              <label className="block text-sm font-medium">Task title<input autoFocus name="title" required maxLength={200} defaultValue={editor === "new" ? "" : editor.title} className={inputClass} /></label>
              <label className="block text-sm font-medium">Details <span className="font-normal text-slate-500">(optional)</span><textarea name="details" rows={3} maxLength={2000} defaultValue={editor === "new" ? "" : editor.details || ""} className={inputClass} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="project-task-assignee" className="block text-sm font-medium">Assign to</label><select id="project-task-assignee" name="assigneeId" defaultValue={editor === "new" ? "" : editor.assigneeId || ""} className={inputClass}><option value="">Unassigned</option>{project.members.map(member => <option key={member.userId} value={member.userId}>{member.name}{member.userId === currentUserId ? " (you)" : ""}</option>)}</select></div>
                <div><label htmlFor="project-task-priority" className="block text-sm font-medium">Priority</label><select id="project-task-priority" name="priority" defaultValue={editor === "new" ? "MEDIUM" : editor.priority} className={inputClass}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></div>
                <label className="block text-sm font-medium">Due date <span className="font-normal text-slate-500">(optional)</span><input name="dueDate" type="date" min="1900-01-01" max="9999-12-31" defaultValue={editor === "new" ? "" : editor.dueDate || ""} className={inputClass} /></label>
              </div>
              <div className="flex gap-2"><button className={primaryButton}>{pending ? "Saving…" : editor === "new" ? "Create task" : "Save changes"}</button><button className={secondaryButton} type="button" onClick={() => setEditor(null)}>Cancel</button></div>
            </fieldset>
          </form>}
          <Feedback error={error} success={success} />
          <div aria-label="Filter project tasks" className="mt-5 flex flex-wrap gap-1 border-b border-slate-200 pb-3">
            {(["open", "mine", "completed", "all"] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === value ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}>{value === "mine" ? "Assigned to me" : value[0].toUpperCase() + value.slice(1)}</button>)}
          </div>
          {visibleTasks.length ? <ul className="divide-y divide-slate-100">{visibleTasks.map(task => <ProjectTaskCard key={task.id} project={project} task={task} currentUserId={currentUserId} today={today} onEdit={() => setEditor(task)} onDeleted={() => { if (editor !== "new" && editor?.id === task.id) setEditor(null) }} />)}</ul> : <p className="py-10 text-center text-sm text-slate-500">{filter === "mine" ? "No open tasks are assigned to you." : "No tasks in this view yet."}</p>}
        </section>
        <ProjectDiscussion projectId={project.id} messages={project.messages} />
      </div>
      <aside className="min-w-0 space-y-6">
        <section className={`${panelClass} border-indigo-100 bg-indigo-50/50`} aria-labelledby="reminders-heading">
          <h2 id="reminders-heading" className="text-lg font-semibold">Your reminders</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Your overdue tasks and deadlines in the next 7 days. Dates use UTC.</p>
          {reminders.length ? <ul className="mt-4 space-y-3">{reminders.map(task => <li key={task.id} className="rounded-xl border border-indigo-100 bg-white p-3"><a href={`#project-task-${task.id}`} onClick={() => setFilter("mine")} className="break-words text-sm font-medium text-indigo-950 hover:underline">{task.title}</a><p className={`mt-1 text-xs ${task.dueDate! < today ? "font-semibold text-red-700" : "text-slate-500"}`}>{task.dueDate! < today ? "Overdue · " : task.dueDate === today ? "Due today · " : "Due "}{displayDate(task.dueDate!)}</p></li>)}</ul> : <p className="mt-5 text-sm text-slate-600">No upcoming deadlines for your tasks.</p>}
        </section>
        <section className={panelClass} aria-labelledby="members-heading"><h2 id="members-heading" className="text-lg font-semibold">Your team</h2><ul className="mt-4 space-y-3">{project.members.map(member => <li key={member.userId} className="flex items-center gap-3"><span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{member.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="break-words text-sm font-medium">{member.name}{member.userId === currentUserId ? " (you)" : ""}</p><p className="text-xs text-slate-500">{member.userId === project.ownerId ? "Project admin" : "Member"}</p></div></li>)}</ul></section>
        {owner && <ProjectInvitations projectId={project.id} activeInvitation={project.activeInvitation} />}
      </aside>
    </div>
    <p className="mt-7 text-xs text-slate-500">Use Refresh project to see the latest updates from your team.</p>
  </>
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white px-5 py-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>
}
