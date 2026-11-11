"use client"

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg px-6 py-20 text-center"><h1 className="text-2xl font-bold">Your workspace couldn’t load</h1><p className="mt-4 text-sm leading-6 text-slate-600">Please try again in a moment. If this continues, contact the person running PadhSang.</p><button onClick={reset} className="mt-6 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Try again</button></main>
}
