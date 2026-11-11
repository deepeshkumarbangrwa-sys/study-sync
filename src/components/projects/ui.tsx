import Link from "next/link"
import type { ReactNode } from "react"

export const primaryButton = "inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
export const secondaryButton = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
export const inputClass = "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100"
export const panelClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"

export function ProjectShell({ children, name }: { children: ReactNode; name: string }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/projects" className="flex items-center gap-3 font-bold tracking-tight">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm text-white">PS</span>
            <span className="text-xl">PadhSang</span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm font-medium sm:gap-6">
            <Link href="/" className="text-slate-600 hover:text-indigo-700">My workspace</Link>
            <Link href="/projects" className="text-indigo-700">Projects</Link>
            <span className="hidden max-w-44 truncate border-l border-slate-200 pl-6 text-slate-500 sm:inline">{name}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">{children}</main>
    </div>
  )
}

export function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  return <>
    {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
  </>
}

export function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))
}

export function displayTimestamp(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(date))
}
