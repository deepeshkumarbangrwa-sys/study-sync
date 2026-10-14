import { auth, signOut } from "@/auth"

export default async function HomePage() {
  // This grabs your secure Google profile data
  const session = await auth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg text-center">
        <h1 className="mb-4 text-3xl font-bold text-gray-900">Study Sync Dashboard</h1>
        
        <div className="mb-8 rounded-lg bg-blue-50 p-4 text-left">
          <p className="font-medium text-blue-900">Authentication Successful!</p>
          <p className="mt-2 text-sm text-gray-700">Name: {session?.user?.name}</p>
          <p className="text-sm text-gray-700">Email: {session?.user?.email}</p>
        </div>

        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/login" })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}