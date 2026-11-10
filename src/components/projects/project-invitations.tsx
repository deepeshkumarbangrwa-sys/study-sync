"use client"

import { useId, useRef, useState } from "react"
import { createProjectInvitation, revokeProjectInvitation } from "@/app/projects/actions"
import { displayTimestamp, Feedback, inputClass, panelClass, primaryButton, secondaryButton } from "./ui"
import { useProjectAction } from "./use-project-action"

export function ProjectInvitations({
  projectId,
  activeInvitation,
}: {
  projectId: string
  activeInvitation: { expiresAt: string } | null
}) {
  const headingId = useId()
  const linkId = useId()
  const linkRef = useRef<HTMLTextAreaElement>(null)
  const [createdLink, setCreatedLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [confirmation, setConfirmation] = useState<"replace" | "revoke" | null>(null)
  const [copyMessage, setCopyMessage] = useState("")
  const { run, pending, error, success } = useProjectAction()
  const expiresAt = createdLink?.expiresAt ?? activeInvitation?.expiresAt

  function createLink() {
    setCopyMessage("")
    run(() => createProjectInvitation(projectId), (invitation) => {
      setCreatedLink({ url: `${window.location.origin}/join/${invitation.token}`, expiresAt: invitation.expiresAt })
      setConfirmation(null)
    }, "Invitation link created.")
  }

  function revokeLink() {
    setCopyMessage("")
    run(() => revokeProjectInvitation(projectId), () => {
      setCreatedLink(null)
      setConfirmation(null)
    }, "Invitation link revoked. Existing members still have access.")
  }

  async function copyLink() {
    if (!createdLink) return
    try {
      await navigator.clipboard.writeText(createdLink.url)
      setCopyMessage("Invitation link copied.")
    } catch {
      linkRef.current?.focus()
      linkRef.current?.select()
      setCopyMessage("Copy was unavailable. The link is selected—copy it using your device’s copy command.")
    }
  }

  return (
    <section className={panelClass} aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-semibold">Invite your team</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Share an invitation link with your teammates. Anyone with the link can join after signing in.</p>
      {expiresAt && <p className="mt-3 text-xs leading-5 text-indigo-700">Current invitation expires <time dateTime={expiresAt}>{displayTimestamp(expiresAt)} UTC</time>.</p>}

      {createdLink ? <div className="mt-4">
        <label htmlFor={linkId} className="text-sm font-medium">Invitation link</label>
        <textarea ref={linkRef} id={linkId} readOnly rows={3} value={createdLink.url} className={`${inputClass} break-all font-mono text-xs`} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" onClick={copyLink} className={`${secondaryButton} mt-3`}>Copy link</button>
        <p className="mt-2 text-xs leading-5 text-slate-500">Copy the link before leaving this page. If you lose it, create a new one below.</p>
      </div> : activeInvitation && <p className="mt-3 text-xs leading-5 text-slate-500">An invitation is active. If you no longer have its link, create a new one. The previous link will stop working.</p>}

      {confirmation ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm leading-6 text-amber-950">{confirmation === "replace" ? "Create a new invitation? The previous link will stop working." : "Revoke this invitation? People with its link will no longer be able to join."} Existing members will keep their access.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={confirmation === "replace" ? createLink : revokeLink} className={primaryButton}>{pending ? "Saving…" : confirmation === "replace" ? "Replace invitation" : "Revoke invitation"}</button>
          <button type="button" disabled={pending} onClick={() => setConfirmation(null)} className={secondaryButton}>Cancel</button>
        </div>
      </div> : <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => expiresAt ? setConfirmation("replace") : createLink()} className={primaryButton}>{pending ? "Creating…" : expiresAt ? "Create new link" : "Create invitation link"}</button>
        {expiresAt && <button type="button" disabled={pending} onClick={() => setConfirmation("revoke")} className={secondaryButton}>Revoke link</button>}
      </div>}

      {copyMessage && <p role="status" className="mt-3 text-sm leading-6 text-slate-600">{copyMessage}</p>}
      <Feedback error={error} success={success} />
    </section>
  )
}
