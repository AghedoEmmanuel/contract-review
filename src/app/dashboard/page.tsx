import { redirect } from "next/navigation"
import UploadForm from "@/components/UploadForm"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      contracts: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { clauses: true } }
        }
      }
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <span className="font-bold text-xl text-blue-600">ContractReview AI</span>
        <span className="text-gray-600 text-sm">{session.user.email}</span>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

        <UploadForm />

        <div className="mt-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Your Contracts
          </h2>

          {user?.contracts.length === 0 ? (
            <p className="text-gray-500">No contracts uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {user?.contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="bg-white p-4 rounded-lg border flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {contract.fileName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(contract.createdAt).toLocaleDateString()}
                      {contract._count.clauses > 0 && (
                        <span className="ml-2 text-blue-600">
                          {contract._count.clauses} clauses found
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    contract.status === "clauses_extracted"
                      ? "bg-green-100 text-green-700"
                      : contract.status === "extracting_clauses"
                      ? "bg-blue-100 text-blue-700"
                      : contract.status === "extracting"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    {contract.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}