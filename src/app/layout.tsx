import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "PadhSang — Plan. Collaborate. Progress.",
  description: "Plan projects, collaborate with your team, manage deadlines, and make steady progress with PadhSang.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full">{children}</body></html>
}
