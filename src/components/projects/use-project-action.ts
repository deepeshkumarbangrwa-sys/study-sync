"use client"

import { useState, useTransition } from "react"

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export function useProjectAction() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function run<T>(operation: () => Promise<Result<T>>, onSuccess?: (data: T) => void, message?: string) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      try {
        const result = await operation()
        if (!result.ok) {
          setError(result.error)
          return
        }
        onSuccess?.(result.data)
        if (message) setSuccess(message)
      } catch {
        setError("That change could not be saved. Check your connection and try again.")
      }
    })
  }

  return { pending, error, success, run }
}
