"use client"

import {useState} from "react"
import {useRouter} from "next/navigation"

type ClauseData = {
    id:string,
    orderIndex:number,
    content:string,
    riskLevel:string
    riskExplanation:string,
    ambiguousLanguage:string[],
    recommendations:string[],
    existingDecision:string|null,
    existingAnnotation:string|null,
}

type Decision={
    decision:"approved"|"rejected",
    annotation:string
}

const riskColours: Record<string, string> = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-green-100 text-green-700 border-green-200",
}

const ReviewForm = (
    {contractId, clauses}:{contractId:string, clauses:ClauseData[]}
) => {

    const router = useRouter()
    const [decisions, setDecisions] = useState<Record<string, Decision>>(
        Object.fromEntries(
            clauses
            .filter(c=>c.existingDecision)
            .map(c=>[c.id,{
                decision:c.existingDecision as "approved"|"rejected",
                annotation:c.existingAnnotation ?? "",
            }])
        )
    )
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")

    const setDecision = (clauseId:string, decision:"approved"|"rejected") =>{
        setDecisions(prev=>({
            ...prev,
            [clauseId]:{
                decision,
                annotation: prev[clauseId]?.annotation ?? "",
            },
        }))
    }

    const setAnnotation = (clauseId:string, annotation:string) =>{
        setDecisions(prev=>({
            ...prev,
            [clauseId]:{
                decision: prev[clauseId]?.decision ?? "approved",
                annotation,
            }
        }))
    }

    const reviewedCount = Object.keys(decisions).length
    const allReviewed = reviewedCount === clauses.length

    const handleSubmit = async ()=>{
        if(!allReviewed){
            setError("Please review all clauses before submitting.")
            return
        }
        setSubmitting(true)
        setError("")

        const res = await fetch(`/api/contracts/${contractId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisions: Object.entries(decisions).map(([clauseId, d]) => ({
          clauseId,
          decision: d.decision,
          annotation: d.annotation || undefined,
        })),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || "Something went wrong")
      setSubmitting(false)
      return
    }

    router.push(`/dashboard/contracts/${contractId}`)
    router.refresh()
    }

  return (
    <div>
      {/* Progress bar */}
      <div className="bg-white border rounded-lg p-4 mb-6 sticky top-4 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {reviewedCount} of {clauses.length} clauses reviewed
          </span>
          {allReviewed && (
            <span className="text-sm text-green-600 font-medium">
              ✓ All reviewed
            </span>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(reviewedCount / clauses.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {clauses.map((clause) => {
          const current = decisions[clause.id]

          return (
            <div
              key={clause.id}
              className={`bg-white border rounded-lg p-6 ${
                current ? "border-l-4 border-l-blue-500" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-sm text-gray-500 font-medium">
                  Clause {clause.orderIndex}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                  riskColours[clause.riskLevel]
                }`}>
                  {clause.riskLevel} risk
                </span>
              </div>

              <p className="text-gray-800 text-sm leading-relaxed mb-4">
                {clause.content}
              </p>

              <div className="bg-gray-50 rounded-md p-3 mb-4 text-sm text-gray-600">
                {clause.riskExplanation}
              </div>

              {clause.ambiguousLanguage.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {clause.ambiguousLanguage.map((term) => (
                    <span
                      key={term}
                      className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              )}

              {/* Reviewer controls */}
              <div className="border-t pt-4">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setDecision(clause.id, "approved")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      current?.decision === "approved"
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-green-50"
                    }`}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => setDecision(clause.id, "rejected")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      current?.decision === "rejected"
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-red-50"
                    }`}
                  >
                    ✗ Reject
                  </button>
                </div>

                <textarea
                  placeholder="Add a note (optional)..."
                  value={current?.annotation ?? ""}
                  onChange={(e) => setAnnotation(clause.id, e.target.value)}
                  className="w-full text-sm border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!allReviewed || submitting}
        className="mt-6 w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Submitting review..." : "Submit Review"}
      </button>
    </div>
  )
}

export default ReviewForm