'use client'

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { signIn } from "next-auth/react"


const LoginPage = () => {

    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) =>{
      e.preventDefault()
      setLoading(true)
      setError("")

      const result = await signIn("credentials",{
        email,
        password,
        redirect: false,
      })

      if(result?.error){
        setError("Invalid email or password")
        setLoading(false)
      } else{
        router.push("/dashboard")
      }
    }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-500">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sign in</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            />
          </div>
          <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-600 text-center">
          Don`&apos`t have an account?{" "}
          <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>

      </div>
    </div>
  )
}

export default LoginPage
