import { AuthError } from "next-auth"
import { redirect } from "next/navigation"
import { auth, signIn } from "@/auth"
import { authSecretConfigured, signInProviders } from "@/auth.config"
import { safeAuthRedirect } from "@/lib/auth-redirect"

function errorMessage(error: string | undefined) {
  switch (error) {
    case undefined:
      return null
    case "OAuthAccountNotLinked":
      return "This email already has an account. Use the sign-in provider you used originally to access your workspace."
    case "AccessDenied":
      return "Sign-in was not approved. Try again and allow access, or use another account. Your organisation may require administrator approval."
    case "Configuration":
      return "Sign-in is temporarily unavailable. Please contact the project owner."
    case "SessionRequired":
      return "Please sign in to access your workspace."
    default:
      return "We could not complete sign-in. Please try again. If the problem continues, contact the project owner."
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[]
    callbackUrl?: string | string[]
  }>
}) {
  const { error, callbackUrl } = await searchParams
  const returnTo = safeAuthRedirect(callbackUrl)

  if (authSecretConfigured) {
    const session = await auth()
    if (session?.user) redirect(returnTo)
  }

  const message = errorMessage(Array.isArray(error) ? error[0] : error)
  const canSignIn =
    authSecretConfigured && signInProviders.some((provider) => provider.configured)

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-sm">
            SS
          </div>
          <h1 className="text-3xl font-bold tracking-tight">StudySync</h1>
          <p className="mt-2 text-slate-600">Make room for focused study.</p>
        </div>

        <section aria-labelledby="sign-in-heading" className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 id="sign-in-heading" className="text-xl font-semibold">Your study workspace</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Plan your work, protect your focus, and collaborate with students
            or colleagues. Sign in with your own Google or Microsoft account.
          </p>

          {message && (
            <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
              {message}
            </p>
          )}

          {!canSignIn && (
            <p role="status" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              Sign-in is not available yet. The project owner needs to finish
              setting up authentication before you can access your workspace.
            </p>
          )}

          <div className="mt-6 space-y-3">
            {signInProviders.map((provider) => {
              const available = authSecretConfigured && provider.configured
              return (
                <form
                  key={provider.id}
                  action={async () => {
                    "use server"
                    if (!authSecretConfigured || !provider.configured) {
                      redirect(`/login?error=Configuration&callbackUrl=${encodeURIComponent(returnTo)}`)
                    }
                    try {
                      await signIn(provider.id, { redirectTo: returnTo })
                    } catch (error) {
                      if (error instanceof AuthError) {
                        redirect(`/login?error=${encodeURIComponent(error.type)}&callbackUrl=${encodeURIComponent(returnTo)}`)
                      }
                      throw error
                    }
                  }}
                >
                  <button
                    type="submit"
                    disabled={!available}
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold transition hover:border-indigo-400 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {provider.id === "microsoft-entra-id" ? (
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20">
                        <path fill="#f25022" d="M0 0h9v9H0z" />
                        <path fill="#7fba00" d="M11 0h9v9h-9z" />
                        <path fill="#00a4ef" d="M0 11h9v9H0z" />
                        <path fill="#ffb900" d="M11 11h9v9h-9z" />
                      </svg>
                    ) : (
                      <span aria-hidden="true" className="text-lg font-bold text-indigo-600">G</span>
                    )}
                    Continue with {provider.name}
                    {!available && <span className="text-xs font-normal">(unavailable)</span>}
                  </button>
                </form>
              )
            })}
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            Microsoft personal, work, and school accounts are supported. Your
            organisation may have its own sign-in rules. StudySync does not
            receive your account password.
          </p>
        </section>
        <p className="mt-6 text-center text-xs text-slate-500">Plan your work. Protect your focus.</p>
      </div>
    </main>
  )
}
