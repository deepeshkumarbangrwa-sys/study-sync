import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const firstName = session.user.name?.split(" ")[0] || "Student"

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-sm">
              SS
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                StudySync
              </h1>
              <p className="text-xs text-slate-500">Workspace & Planner</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 border-r border-slate-200 pr-4">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "Profile"}
                  className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
                  {firstName[0]}
                </div>
              )}
              <div className="hidden sm:block">
                <p className="text-sm font-medium leading-none text-slate-900">
                  {session.user.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {session.user.email}
                </p>
              </div>
            </div>

            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/login" })
              }}
            >
              <button
                type="submit"
                className="rounded-lg bg-red-50 px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Welcome Banner */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white shadow-md">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Welcome back, {firstName}! 👋
          </h2>
          <p className="mt-2 max-w-xl text-indigo-100">
            Your database is connected and your workspace is ready. Track your
            upcoming assignments, manage module deadlines, and log your study
            sessions below.
          </p>
        </div>

        {/* Quick Stats Row */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pending Tasks</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">0</p>
            <p className="mt-1 text-xs text-emerald-600">All caught up!</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Study Hours This Week
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">0h</p>
            <p className="mt-1 text-xs text-slate-400">
              Start a session to track time
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Active Modules</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">1</p>
            <p className="mt-1 text-xs text-indigo-600">SP126 Project Active</p>
          </div>
        </div>

        {/* Two-Column Workspace */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Tasks List */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Study Tasks & Deadlines
                  </h3>
                  <p className="text-sm text-slate-500">
                    Keep track of your coursework and exam prep
                  </p>
                </div>
                <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
                  + New Task
                </button>
              </div>

              <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No tasks created yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Next step: We will wire this section to a Prisma Task table so
                  you can add and check off real assignments.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Account & Quick Info */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Quick Focus Timer
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                25-minute Pomodoro study block
              </p>
              <div className="my-6 text-center">
                <span className="font-mono text-4xl font-bold tracking-wider text-slate-800">
                  25:00
                </span>
              </div>
              <button className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
                Start Session
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Connected Profile
              </h3>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-medium text-emerald-600">
                    Authenticated (SQLite)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Provider:</span>
                  <span className="font-medium text-slate-800">Google OAuth</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}