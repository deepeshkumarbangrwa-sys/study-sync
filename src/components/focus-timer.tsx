"use client"

import { useEffect, useState, useTransition } from "react"
import { startStudySession, abandonStudySession, completeStudySession } from "@/app/actions"
import type { FocusSession } from "@/lib/planner-validation"

export function FocusTimer({ session }: { session: FocusSession | null }) {
  const [remaining, setRemaining] = useState(session?.durationSeconds || 1500)
  const [clockReady, setClockReady] = useState(!session)
  const [error, setError] = useState("")
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!session) return
    function tick() {
      const elapsed = (Date.now() - Date.parse(session!.startedAt)) / 1000
      setRemaining(Math.max(0, Math.min(session!.durationSeconds, Math.ceil(session!.durationSeconds - elapsed))))
      setClockReady(true)
    }
    // Update from the saved start time, so background tabs and reloads keep time.
    const timeout = window.setTimeout(tick, 0)
    const interval = window.setInterval(tick, 1000)
    window.addEventListener("focus", tick)
    return () => { window.clearTimeout(timeout); window.clearInterval(interval); window.removeEventListener("focus", tick) }
  }, [session])

  function run(action: () => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>) {
    setError("")
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) setError(result.error)
      } catch { setError("We couldn’t save your session. Check your connection and try again.") }
    })
  }

  const finished = Boolean(session && clockReady && remaining === 0)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="focus-heading">
      <div className="flex items-center justify-between gap-2"><h2 id="focus-heading" className="text-lg font-semibold">Focus timer</h2><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">25 min</span></div>
      <p className="mt-1 text-sm text-slate-500">One task. A little less distraction.</p>
      <div className="my-8 text-center"><p role="timer" aria-label="Time remaining" className="font-mono text-5xl font-semibold tracking-tight text-slate-900">{!clockReady ? "--:--" : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`}</p><p role="status" className="mt-3 text-xs text-slate-500">{finished ? "Session complete. Save your study time below." : session ? "Focus time is running" : "Ready when you are"}</p></div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!session ? <button disabled={pending} onClick={() => run(startStudySession)} className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800">{pending ? "Starting…" : "Start session"}</button> : <>
        {finished && <button disabled={pending} onClick={() => run(() => completeStudySession(session.id))} className="mb-3 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700">{pending ? "Saving…" : "Save completed session"}</button>}
        {confirmDiscard ? <div className="rounded-lg bg-slate-50 p-3"><p className="text-sm text-slate-700">Discard this session? Its time won’t be added to your total.</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={pending} onClick={() => run(() => abandonStudySession(session.id))} className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white">{pending ? "Discarding…" : "Discard session"}</button><button disabled={pending} onClick={() => setConfirmDiscard(false)} className="px-3 py-2 text-xs font-medium">Keep session</button></div></div> : <button disabled={pending} onClick={() => setConfirmDiscard(true)} className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Reset session</button>}
        <p className="mt-4 text-xs leading-5 text-slate-500">You can leave this page and return to your timer. Save a finished session to add 25 minutes to your weekly total.</p>
      </>}
    </section>
  )
}
