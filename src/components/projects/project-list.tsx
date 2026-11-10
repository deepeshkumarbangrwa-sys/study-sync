"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createProject } from "@/app/projects/actions"
import type { ProjectSummary } from "@/lib/project-validation"
import { Feedback, inputClass, panelClass, primaryButton } from "./ui"
import { useProjectAction } from "./use-project-action"

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  const router = useRouter()
  const { run, pending, error } = useProjectAction()
  const [showForm, setShowForm] = useState(projects.length === 0)

  return <>
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-600">Work better together</p>
        <h1 className="text-3xl font-bold tracking-tight">Your projects</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">A shared space for your group to plan tasks, discuss ideas, and give feedback.</p>
      </div>
      <button className={primaryButton} onClick={() => setShowForm(!showForm)} aria-expanded={showForm} aria-controls="create-project-form">{showForm ? "Close form" : "+ New project"}</button>
    </div>

    {showForm && <section id="create-project-form" className={`${panelClass} mb-8 max-w-2xl`} aria-labelledby="create-heading">
      <h2 id="create-heading" className="text-lg font-semibold">Create a project</h2>
      <p className="mt-1 text-sm text-slate-500">You can invite your team once your project is ready.</p>
      <form onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        run(() => createProject({ name: String(data.get("name") ?? ""), description: String(data.get("description") ?? "") }), (created) => router.push(`/projects/${created.id}`))
      }} className="mt-5 space-y-4">
        <fieldset disabled={pending} className="space-y-4">
          <label className="block text-sm font-medium">Project name<input name="name" required maxLength={100} className={inputClass} placeholder="e.g. Final year research project" /></label>
          <label className="block text-sm font-medium">Description <span className="font-normal text-slate-400">(optional)</span><textarea name="description" maxLength={1000} rows={3} className={inputClass} placeholder="What will your group achieve?" /></label>
          <button className={primaryButton} type="submit">{pending ? "Creating…" : "Create project"}</button>
        </fieldset>
        <Feedback error={error} />
      </form>
    </section>}

    {projects.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => <Link href={`/projects/${project.id}`} key={project.id} className={`${panelClass} block transition hover:border-indigo-300 hover:shadow-md`}>
        <div aria-hidden="true" className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-700">{project.name.slice(0, 1).toUpperCase()}</div>
        <h2 className="break-words text-lg font-semibold">{project.name}</h2>
        <p className="mt-2 line-clamp-3 min-h-12 break-words text-sm leading-6 text-slate-500">{project.description || "Your team’s tasks, conversations, and feedback in one place."}</p>
        <div className="mt-6 flex justify-between border-t border-slate-100 pt-4 text-xs font-medium text-slate-500"><span>{project.memberCount} {project.memberCount === 1 ? "member" : "members"}</span><span>{project.pendingTasks} open {project.pendingTasks === 1 ? "task" : "tasks"} <span aria-hidden="true" className="ml-1 text-indigo-600">→</span></span></div>
      </Link>)}
    </div> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center"><h2 className="font-semibold">Your next project starts here</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Create your first project above, or open an invitation link from a teammate to join their project.</p></div>}
  </>
}
