import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { authSecretConfigured } from "@/auth.config"
import { getProjectsForUser } from "@/lib/projects"
import { ProjectList } from "@/components/projects/project-list"
import { ProjectShell } from "@/components/projects/ui"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  if (!authSecretConfigured) redirect("/login?callbackUrl=%2Fprojects")
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fprojects")
  const projects = await getProjectsForUser(session.user.id)
  return <ProjectShell name={session.user.name || "Your account"}><ProjectList projects={projects} /></ProjectShell>
}
