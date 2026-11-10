import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "StudySync — Workspace & Planner",
  description: "Organise your coursework, manage deadlines, and track your study sessions with StudySync.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full">{children}</body></html>
}
