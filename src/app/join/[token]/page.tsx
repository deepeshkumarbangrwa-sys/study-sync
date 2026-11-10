import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { authSecretConfigured } from "@/auth.config"
import { previewInvitationForUser } from "@/lib/projects"
import { JoinProjectButton } from "@/components/projects/join-project-button"
import { ProjectShell, displayTimestamp, panelClass, primaryButton } from "@/components/projects/ui"

export const metadata = { title: "Join a project | StudySync", referrer: "no-referrer" }

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const login = `/login?callbackUrl=${encodeURIComponent(`/join/${token}`)}`
  if (!authSecretConfigured) redirect(login)
  const session = await auth()
  if (!session?.user?.id) redirect(login)
  const invitation = await previewInvitationForUser(session.user.id, token)

  return <ProjectShell name={session.user.name || "Your account"}>
    <section className={`${panelClass} mx-auto mt-8 max-w-lg`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-600">A space to work together</p>
      {!invitation ? <>
        <h1 className="text-2xl font-bold">This invitation is unavailable</h1>
        <p className="my-4 text-sm leading-6 text-slate-600">The link may be invalid, expired, or revoked. Ask the project owner to share a new invitation.</p>
        <Link href="/projects" className={primaryButton}>Go to your projects</Link>
      </> : <>
        <h1 className="break-words text-2xl font-bold">{invitation.alreadyMember ? "You’re already a member" : `Join ${invitation.projectName}`}</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">{invitation.alreadyMember ? `Continue to ${invitation.projectName} to see your team’s work.` : "Joining gives you access to this project’s tasks and discussions. Other members will see your name and contributions."}</p>
        <p className="mb-6 mt-3 text-xs text-slate-500">Invitation expires {displayTimestamp(invitation.expiresAt)} UTC.</p>
        {invitation.alreadyMember ? <Link href={`/projects/${invitation.projectId}`} className={primaryButton}>Open project</Link> : <JoinProjectButton token={token} />}
      </>}
    </section>
  </ProjectShell>
}
