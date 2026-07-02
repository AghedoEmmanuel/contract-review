import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import ReviewForm from "@/components/ReviewForm";
import Link from "next/link";

export default async function ReviewPage(
    { params }: { params: { id: string } }
){
    const session = await auth()
        if (!session?.user?.email) {
        redirect("/login")
    }
    
    const contract = await prisma.contract.findUnique({
        where:{id:params.id},
        include:{
            clauses:{
                orderBy:{orderIndex:"asc"},
                include:{analysis:true, reviewDecision:true},
            },
            user:true,
        }
    })

    if (!contract || contract.user.email !== session.user.email){
        redirect("/dashboard")
    }

    if (contract.status !== "awaiting_review"){
        return(
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600">
                        This contract is not currently awaiting review.
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        Status:{contract.status.replace(/_/g, " ")}
                    </p>
                </div>
            </div>
        )
    }

     // Sort high risk first, same as the detail page
  const sortedClauses = contract.clauses.slice().sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
    const aRisk = a.analysis?.riskLevel ?? "low"
    const bRisk = b.analysis?.riskLevel ?? "low"
    return (order[aRisk] ?? 2) - (order[bRisk] ?? 2)
  })

  return(
    <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b px-8 py-4">
            <span className="font-bold text-xl text-blue-600">ContractReview AI</span>
        </nav>
        {contract.status === "awaiting_review" && (
  <Link
    href={`/dashboard/contracts/${contract.id}/review`}
    className="inline-block mb-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
  >
    Start Review →
  </Link>
)}

        <main className="max-w-4xl mx-auto px-8 py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Review: {contract.fileName}
            </h1>
            <p className="text-grey-500 mb-8">
                Approve, reject or annotate each clause below
            </p>
            <ReviewForm
            contractId={contract.id}
            clauses={sortedClauses.map(c=>({
                id:c.id,
                orderIndex:c.orderIndex,
                content:c.content,
                riskLevel: c.analysis?.riskLevel ?? "low",
                riskExplanation: c.analysis?.riskExplanation ?? "",   
                ambiguousLanguage: c.analysis?.ambiguousLanguage ?? [],
                recommendations: c.analysis?.recommendations ?? [],
                existingDecision: c.reviewDecision?.decision ?? null,
                existingAnnotation: c.reviewDecision?.annotation ?? null,
            }))}
            />
        </main>
    </div>
  )
}