import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

export const authSecretConfigured = Boolean(
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
)

export const signInProviders = [
  {
    id: "google",
    name: "Google",
    configured: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
    ),
  },
  {
    id: "microsoft-entra-id",
    name: "Microsoft",
    configured: Boolean(
      process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
        process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    ),
  },
] as const

const providers: NextAuthConfig["providers"] = []

if (signInProviders[0].configured) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  )
}

if (signInProviders[1].configured) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer:
        process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ||
        "https://login.microsoftonline.com/common/v2.0",
    }),
  )
}

export default {
  providers,
  session: { strategy: "database" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
} satisfies NextAuthConfig
