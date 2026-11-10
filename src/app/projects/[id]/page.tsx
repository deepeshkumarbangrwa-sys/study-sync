import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"
import { authSecretConfigured } from "@/auth.config"
import { getProjectForUser } from "@/lib/projects"
import { ProjectWorkspace } from "@/components/projects/project-workspace"
import { ProjectShell } from "@/components/projects/ui"

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const login = `/login?callbackUrl=${encodeURIComponent(`/projects/${id}`)}`
  if (!authSecretConfigured) redirect(login)
  const session = await auth()
  if (!session?.user?.id) redirect(login)
  const project = await getProjectForUser(session.user.id, id)
  if (!project) notFound()
  return <ProjectShell name={session.user.name || "Your account"}>
    <ProjectWorkspace project={project} currentUserId={session.user.id} today={new Date().toISOString().slice(0, 10)} />
  </ProjectShell>
}
