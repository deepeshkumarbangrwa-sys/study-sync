"use client"

import { useState, useTransition, type FormEvent } from "react"
import { createTask, updateTask, setTaskCompleted, deleteTask } from "@/app/actions"
import type { TaskItem } from "@/lib/planner-validation"

type Filter = "pending" | "completed" | "all"
type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string }
const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"

export function TaskList({ tasks }: { tasks: TaskItem[] }) {
  const [filter, setFilter] = useState<Filter>("pending")
  const [editor, setEditor] = useState<TaskItem | "new" | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [pending, startTransition] = useTransition()
  const visibleTasks = tasks.filter(task => filter === "all" || task.completed === (filter === "completed"))

  function mutate(action: () => Promise<ActionResult>, message: string, after?: () => void) {
    setError(""); setNotice("")
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) { setError(result.error); return }
        setNotice(message); after?.()
      } catch { setError("We couldn’t save that change. Check your connection and try again.") }
    })
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const input = { title: String(data.get("title") || ""), module: String(data.get("module") || ""), dueDate: String(data.get("dueDate") || "") }
    const editing = editor && editor !== "new" ? editor : null
    mutate(() => editing ? updateTask(editing.id, input) : createTask(input), editing ? "Task updated." : "Task added.", () => { setEditor(null); if (!editing) setFilter("pending") })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="tasks-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="tasks-heading" className="text-lg font-semibold">Personal tasks & deadlines</h2><p className="mt-1 text-sm text-slate-500">Coursework, exam prep, and your next steps.</p></div>
        <button disabled={pending} aria-expanded={editor === "new"} onClick={() => { setEditor(editor === "new" ? null : "new"); setError(""); setNotice("") }} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">+ New task</button>
      </div>
      {editor && (
        <form key={editor === "new" ? "new" : editor.id} onSubmit={saveTask} className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <h3 className="mb-4 text-sm font-semibold">{editor === "new" ? "Add a task" : "Edit task"}</h3>
          <fieldset disabled={pending} className="space-y-4">
            <div><label htmlFor="task-title" className="text-sm font-medium">Task title</label><input autoFocus id="task-title" name="title" required maxLength={200} defaultValue={editor === "new" ? "" : editor.title} placeholder="e.g. Draft the methodology chapter" className={inputClass} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="task-module" className="text-sm font-medium">Module <span className="font-normal text-slate-500">(optional)</span></label><input id="task-module" name="module" maxLength={80} defaultValue={editor === "new" ? "" : editor.module || ""} placeholder="e.g. SP126" className={inputClass} /></div>
              <div><label htmlFor="task-due" className="text-sm font-medium">Due date <span className="font-normal text-slate-500">(optional)</span></label><input id="task-due" name="dueDate" type="date" min="1900-01-01" max="9999-12-31" defaultValue={editor === "new" ? "" : editor.dueDate || ""} className={inputClass} /></div>
            </div>
            <div className="flex gap-2"><button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">{pending ? "Saving…" : "Save task"}</button><button type="button" onClick={() => setEditor(null)} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-100">Cancel</button></div>
          </fieldset>
        </form>
      )}
      <div className="mt-5 flex gap-1 border-b border-slate-200 pb-3" aria-label="Filter tasks">
        {(["pending", "completed", "all"] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === value ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}>{value[0].toUpperCase() + value.slice(1)} <span className="ml-1 text-xs">{tasks.filter(task => value === "all" || task.completed === (value === "completed")).length}</span></button>)}
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <p role="status" className="sr-only">{notice}</p>
      {visibleTasks.length ? <ul className="divide-y divide-slate-100">
        {visibleTasks.map(task => (
          <li key={task.id} className="py-5">
            <div className="flex items-start gap-3">
              <input aria-label={`Mark ${task.title} as ${task.completed ? "pending" : "completed"}`} type="checkbox" checked={task.completed} disabled={pending} onChange={event => { const checked = event.currentTarget.checked; mutate(() => setTaskCompleted(task.id, checked), checked ? "Task completed." : "Task marked as pending.") }} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-indigo-600" />
              <div className="min-w-0 flex-1">
                <p className={`break-words text-sm font-medium leading-6 ${task.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>{task.title}</p>
                {(task.module || task.dueDate) && <div className="mt-2 flex flex-wrap gap-2 text-xs">{task.module && <span className="max-w-full break-words rounded-md bg-indigo-50 px-2 py-1 font-medium text-indigo-700">{task.module}</span>}{task.dueDate && <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">Due <time dateTime={task.dueDate}>{formatDate(task.dueDate)}</time></span>}</div>}
                <div className="mt-3 flex gap-4"><button disabled={pending} onClick={() => { setEditor(task); setDeleteId(null); setError("") }} className="text-xs font-medium text-indigo-700 hover:underline">Edit<span className="sr-only"> {task.title}</span></button><button disabled={pending} onClick={() => { setDeleteId(task.id); setError("") }} className="text-xs font-medium text-slate-500 hover:text-red-700 hover:underline">Delete<span className="sr-only"> {task.title}</span></button></div>
              </div>
            </div>
            {deleteId === task.id && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900"><p>Delete this task? This cannot be undone.</p><div className="mt-2 flex gap-3"><button disabled={pending} onClick={() => mutate(() => deleteTask(task.id), "Task deleted.", () => { setDeleteId(null); if (editor !== "new" && editor?.id === task.id) setEditor(null) })} className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white">{pending ? "Deleting…" : "Delete task"}</button><button disabled={pending} onClick={() => setDeleteId(null)} className="px-2 py-2 text-xs font-medium">Keep task</button></div></div>}
          </li>
        ))}
      </ul> : <div className="py-12 text-center"><p className="text-sm font-medium text-slate-700">{filter === "completed" ? "No completed tasks yet" : filter === "pending" && tasks.length ? "You’re all caught up" : "No tasks here yet"}</p><p className="mt-2 text-sm text-slate-500">{filter === "completed" ? "Tick off a task when you’re finished." : "Add your next assignment or a small step to work on."}</p></div>}
    </section>
  )
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-")
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`
}
