import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import Link from "next/link"

type RiskLevel = "high" | "medium" | "low"

const riskColours: Record<RiskLevel, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
}

const riskOrder: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export default async function ContractDetailPage({params}:{params:{id:string}}) {
    const session = await auth()

    if (!session?.user?.email) redirect("/login")

    const contract = await prisma.contract.findUnique({
        where: { id: params.id },
        include: {
            clauses: {
                orderBy: { orderIndex: "asc" },
                include: {analysis: true},
            },
            user:true,
        },
    })

    if (!contract || contract.user.email !== session.user.email) {
        redirect("/dashboard")
    }

    const analysed = contract.clauses.filter(c => c.analysis)
    const high = analysed.filter(c => c.analysis?.riskLevel === "high").length
    const medium = analysed.filter(c => c.analysis?.riskLevel === "medium").length
    const low = analysed.filter(c => c.analysis?.riskLevel === "low").length

    return(
        <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <span className="font-bold text-xl text-blue-600">ContractReview AI</span>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:underline">
          ← Back to dashboard
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {contract.fileName}
        </h1>

        <div className="flex gap-2 mb-8">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            contract.status === "analysis_complete"
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}>
            {contract.status.replace(/_/g, " ")}
          </span>
        </div>

        {/* Risk summary */}
        {analysed.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-red-700">{high}</p>
              <p className="text-sm text-red-600 mt-1">High Risk</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-yellow-700">{medium}</p>
              <p className="text-sm text-yellow-600 mt-1">Medium Risk</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{low}</p>
              <p className="text-sm text-green-600 mt-1">Low Risk</p>
            </div>
          </div>
        )}

        {/* Clause list — high risk first */}
        <div className="space-y-4">
          {contract.clauses
            .slice()
            .sort((a, b) => {
              const aRisk = (a.analysis?.riskLevel ?? "low") as RiskLevel
              const bRisk = (b.analysis?.riskLevel ?? "low") as RiskLevel
              return (riskOrder[aRisk] ?? 2) - (riskOrder[bRisk] ?? 2)
            })
            .map((clause) => {
              const riskLevel = (clause.analysis?.riskLevel ?? "low") as RiskLevel

              return (
              <div
                key={clause.id}
                className="bg-white border rounded-lg p-6"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm text-gray-500 font-medium">
                    Clause {clause.orderIndex}
                  </span>
                  {clause.analysis && (
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                      riskColours[riskLevel]
                    }`}>
                      {riskLevel} risk
                    </span>
                  )}
                </div>

                <p className="text-gray-800 text-sm leading-relaxed mb-4">
                  {clause.content}
                </p>

                {clause.analysis && (
                  <div className="border-t pt-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Risk Explanation
                      </p>
                      <p className="text-sm text-gray-700">
                        {clause.analysis.riskExplanation}
                      </p>
                    </div>

                    {clause.analysis.ambiguousLanguage.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Ambiguous Language
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {clause.analysis.ambiguousLanguage.map((term) => (
                            <span
                              key={term}
                              className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded"
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {clause.analysis.recommendations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Recommendations
                        </p>
                        <ul className="space-y-1">
                          {clause.analysis.recommendations.map((rec, i) => (
                            <li key={i} className="text-sm text-gray-700 flex gap-2">
                              <span className="text-blue-500 mt-0.5">→</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {!clause.analysis && (
                  <p className="text-sm text-gray-400 italic">
                    Analysis pending...
                  </p>
                )}
              </div>
              )
            })}
        </div>
      </main>
    </div>
    )
}