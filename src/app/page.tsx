import { auth, signOut } from "@/auth"
import { authSecretConfigured } from "@/auth.config"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getDashboard } from "@/lib/planner"
import { getAssignedTasksForUser } from "@/lib/projects"
import { TaskList } from "@/components/task-list"
import { FocusTimer } from "@/components/focus-timer"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  if (!authSecretConfigured) redirect("/login")
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const [dashboard, assignedTasks] = await Promise.all([
    getDashboard(session.user.id),
    getAssignedTasksForUser(session.user.id),
  ])
  const pendingAssignments = assignedTasks.filter((task) => !task.completed)
  const today = new Date().toISOString().slice(0, 10)
  const firstName = session.user.name?.split(" ")[0] || "Student"
  const hours = Math.floor(dashboard.studyMinutesThisWeek / 60)
  const minutes = dashboard.studyMinutesThisWeek % 60

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to workspace</a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 font-bold text-white">SS</div>
            <div><p className="text-xl font-bold tracking-tight">StudySync</p><p className="text-xs text-slate-500">Your study workspace</p></div>
          </div>
          <nav aria-label="Main navigation" className="order-last flex w-full gap-2 border-t border-slate-100 pt-4 md:order-none md:w-auto md:border-0 md:pt-0">
            <Link href="/projects" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Projects</Link>
            <Link href="/" aria-current="page" className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800">My dashboard</Link>
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block"><p className="text-sm font-medium">{session.user.name || "Your account"}</p><p className="max-w-64 truncate text-xs text-slate-500">{session.user.email}</p></div>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }) }}>
              <button className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium transition hover:bg-slate-50">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main id="workspace" className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="mb-7 rounded-2xl bg-gradient-to-r from-indigo-700 to-violet-600 px-6 py-8 text-white sm:px-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-200">Your dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome back, {firstName}.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">See what your team needs from you, plan your own work, and make time to focus.</p>
        </section>
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="assigned-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 id="assigned-heading" className="text-lg font-semibold">Assigned to you <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-sm text-indigo-700">{pendingAssignments.length}</span></h2><p className="mt-1 text-sm text-slate-500">Open a task to mark it done, discuss it, or request more time.</p></div>
            <Link href="/projects" className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">View projects →</Link>
          </div>
          {pendingAssignments.length ? <ul className="mt-4 divide-y divide-slate-100">
            {pendingAssignments.map((task) => {
              const overdue = task.dueDate && task.dueDate < today
              const dueToday = task.dueDate === today
              return <li key={task.id} className="py-4">
                <Link href={`/projects/${task.projectId}#project-task-${task.id}`} className="group flex flex-wrap items-start justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
                  <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{task.title}</p><p className="mt-1 break-words text-xs text-slate-500">{task.projectName}</p></div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-md px-2 py-1 font-medium ${task.priority === "HIGH" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{task.priority[0] + task.priority.slice(1).toLowerCase()} priority</span>
                    {task.dueDate && <span className={`rounded-md px-2 py-1 font-medium ${overdue ? "bg-red-50 text-red-700" : dueToday ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{overdue ? "Overdue · " : dueToday ? "Due today · " : "Due "}<time dateTime={task.dueDate}>{task.dueDate}</time></span>}
                  </div>
                </Link>
              </li>
            })}
          </ul> : <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">No pending project tasks assigned to you. Open a project to see your team’s work, or create one to get started.</p>}
          {pendingAssignments.some((task) => task.dueDate) && <p className="mt-3 text-xs text-slate-500">Reminder dates use UTC.</p>}
        </section>
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Personal pending tasks" value={String(dashboard.pendingTasks)} detail={dashboard.pendingTasks ? "One step at a time" : "All caught up"} />
          <Stat label="Study time this week" value={hours ? `${hours}h ${minutes}m` : `${minutes}m`} detail="Completed focus sessions · week starts Monday (UTC)" />
          <Stat label="Active modules" value={String(dashboard.activeModules)} detail="Modules with pending tasks" />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2"><TaskList tasks={dashboard.tasks} /></div>
          <aside className="space-y-5">
            <FocusTimer key={dashboard.activeSession?.id || "idle"} session={dashboard.activeSession} />
            <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
              <h2 className="font-semibold text-indigo-950">A small plan, a clear start</h2>
              <p className="mt-2 text-sm leading-6 text-indigo-900">Break a large assignment into a few specific tasks. Pick one you can make progress on in your next 25-minute session.</p>
            </section>
          </aside>
        </div>
      </main>
      <footer className="mx-auto max-w-7xl px-5 pb-8 text-xs text-slate-500 sm:px-8">Your personal tasks and study sessions are saved to your account.</footer>
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-sm font-medium text-slate-500">{label}</h2><p className="mt-2 text-3xl font-bold tracking-tight">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></section>
}
