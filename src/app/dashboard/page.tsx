import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
    const session = await auth()

    if (!session){
        redirect("/login")
    }

    return(
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-2">Welcome, {session.user?.name}!</p>
                <p className="text-gray-500 mt-4">Contract upload coming in the next step.</p>
            </div>
        </div>
    )
}