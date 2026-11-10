const LOCAL_ORIGIN = "https://studysync.invalid"

/** Keep post-login navigation on this app, including after an invitation. */
export function safeAuthRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /%(?:2f|5c|25)/i.test(value) ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0)
      return code <= 32 || code === 127
    })
  ) {
    return "/"
  }

  try {
    const decoded = decodeURIComponent(value)
    if (Array.from(decoded).some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    })) return "/"

    const destination = new URL(value, LOCAL_ORIGIN)
    if (destination.origin !== LOCAL_ORIGIN) return "/"

    // Do not send an authenticated user back into the login page or auth API.
    if (
      destination.pathname === "/login" ||
      destination.pathname.startsWith("/login/") ||
      destination.pathname === "/api/auth" ||
      destination.pathname.startsWith("/api/auth/")
    ) return "/"

    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return "/"
  }
}
