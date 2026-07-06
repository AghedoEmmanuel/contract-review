import { describe, it, expect } from "vitest"
import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"

dotenv.config({ path: ".env.test" })

const prisma = new PrismaClient()

async function submitReview(
  contractId: string,
  decisions: { clauseId: string; decision: "approved" | "rejected"; annotation?: string }[]
) {
  // Mirrors exactly what the review API route does
  await prisma.$transaction(
    decisions.map((d) =>
      prisma.reviewDecision.upsert({
        where: { clauseId: d.clauseId },
        create: {
          clauseId: d.clauseId,
          decision: d.decision,
          annotation: d.annotation,
        },
        update: {
          decision: d.decision,
          annotation: d.annotation,
        }
      })
    )
  )

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "reviewed" }
  })
}

describe("Review Submission", () => {
  it("saves all decisions and marks contract as reviewed", async () => {
    const user = await prisma.user.create({
      data: { email: "reviewer@example.com", password: "hashed" }
    })

    const contract = await prisma.contract.create({
      data: {
        userId: user.id,
        fileName: "review-test.pdf",
        status: "awaiting_review",
        reviewToken: "some-token-id",
      }
    })

    const clause1 = await prisma.clause.create({
      data: { contractId: contract.id, content: "Clause 1.", orderIndex: 1 }
    })
    const clause2 = await prisma.clause.create({
      data: { contractId: contract.id, content: "Clause 2.", orderIndex: 2 }
    })

    await submitReview(contract.id, [
      { clauseId: clause1.id, decision: "approved" },
      { clauseId: clause2.id, decision: "rejected", annotation: "Needs revision." },
    ])

    const decisions = await prisma.reviewDecision.findMany({
      where: { clauseId: { in: [clause1.id, clause2.id] } }
    })

    expect(decisions).toHaveLength(2)
    expect(decisions.find(d => d.clauseId === clause1.id)?.decision).toBe("approved")
    expect(decisions.find(d => d.clauseId === clause2.id)?.decision).toBe("rejected")
    expect(decisions.find(d => d.clauseId === clause2.id)?.annotation).toBe("Needs revision.")

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    expect(updated?.status).toBe("reviewed")
  })

  it("resubmitting review updates decisions rather than duplicating", async () => {
    const user = await prisma.user.create({
      data: { email: "resubmit@example.com", password: "hashed" }
    })

    const contract = await prisma.contract.create({
      data: {
        userId: user.id,
        fileName: "resubmit-test.pdf",
        status: "awaiting_review",
        reviewToken: "token-456",
      }
    })

    const clause = await prisma.clause.create({
      data: { contractId: contract.id, content: "Some clause.", orderIndex: 1 }
    })

    // First submission
    await submitReview(contract.id, [
      { clauseId: clause.id, decision: "approved" }
    ])

    // Resubmission with changed decision
    await submitReview(contract.id, [
      { clauseId: clause.id, decision: "rejected", annotation: "Changed my mind." }
    ])

    const decisions = await prisma.reviewDecision.findMany({
      where: { clauseId: clause.id }
    })

    // Must only be one decision, not two
    expect(decisions).toHaveLength(1)
    expect(decisions[0].decision).toBe("rejected")
    expect(decisions[0].annotation).toBe("Changed my mind.")
  })
})