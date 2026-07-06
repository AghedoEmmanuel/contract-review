import { describe, it, expect, vi, beforeEach } from "vitest"
import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"



// Mock all external dependencies
vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({
    text: "This is extracted contract text. It contains several clauses.",
    numpages: 3,
  })
}))

vi.mock("@/lib/llm", () => ({
  extractClauses: vi.fn().mockResolvedValue([
    "The Provider shall deliver services within 30 days.",
    "Payment is due within 14 days of invoice.",
    "Either party may terminate with 30 days notice.",
  ]),
  analyseClause: vi.fn().mockResolvedValue({
    riskLevel: "medium",
    riskExplanation: "Standard clause with some ambiguity.",
    ambiguousLanguage: ["reasonable time"],
    recommendations: ["Define the timeframe specifically."],
  })
}))

vi.mock("@/lib/email", () => ({
  sendReviewNotification: vi.fn().mockResolvedValue(undefined)
}))

// Mock fetch for PDF download
global.fetch = vi.fn().mockResolvedValue({
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
})

dotenv.config({ path: ".env.test" })

const prisma = new PrismaClient()

describe("Contract Processing Logic", () => {
  let userId: string
  let contractId: string

  beforeEach(async () => {
    // Create a real user and contract in the test database
    const user = await prisma.user.create({
      data: { email: "trigger@example.com", password: "hashedpassword" }
    })
    userId = user.id

    const contract = await prisma.contract.create({
      data: {
        userId,
        fileName: "test-contract.pdf",
        fileUrl: "https://example.com/test.pdf",
        status: "uploaded",
      }
    })
    contractId = contract.id
  })

  it("contract starts with uploaded status", async () => {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    })
    expect(contract?.status).toBe("uploaded")
  })

  it("can save extracted text and update status", async () => {
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        extractedText: "Extracted contract text here.",
        status: "extracted"
      }
    })

    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    })

    expect(contract?.status).toBe("extracted")
    expect(contract?.extractedText).toBeTruthy()
  })

  it("saves clauses with correct order index", async () => {
    const clauses = [
      "First clause of the contract.",
      "Second clause of the contract.",
      "Third clause of the contract.",
    ]

    await prisma.clause.createMany({
      data: clauses.map((content, index) => ({
        contractId,
        content,
        orderIndex: index + 1,
      }))
    })

    const saved = await prisma.clause.findMany({
      where: { contractId },
      orderBy: { orderIndex: "asc" }
    })

    expect(saved).toHaveLength(3)
    expect(saved[0].orderIndex).toBe(1)
    expect(saved[2].content).toBe("Third clause of the contract.")
  })

  it("deleting clauses before re-saving prevents duplicates on retry", async () => {
    // Simulate first run
    await prisma.clause.createMany({
      data: [
        { contractId, content: "Original clause.", orderIndex: 1 }
      ]
    })

    // Simulate a retry — delete then recreate
    await prisma.clause.deleteMany({ where: { contractId } })

    await prisma.clause.createMany({
      data: [
        { contractId, content: "New clause one.", orderIndex: 1 },
        { contractId, content: "New clause two.", orderIndex: 2 },
      ]
    })

    const clauses = await prisma.clause.findMany({
      where: { contractId }
    })

    // Should only have 2, not 3
    expect(clauses).toHaveLength(2)
    expect(clauses.find(c => c.content === "Original clause.")).toBeUndefined()
  })

  it("saves clause analysis with correct risk level", async () => {
    const clause = await prisma.clause.create({
      data: {
        contractId,
        content: "Provider shall not be liable for any damages.",
        orderIndex: 1,
      }
    })

    await prisma.clauseAnalysis.create({
      data: {
        clauseId: clause.id,
        riskLevel: "high",
        riskExplanation: "Broad liability waiver.",
        ambiguousLanguage: ["any damages"],
        recommendations: ["Specify damage categories."],
      }
    })

    const analysis = await prisma.clauseAnalysis.findUnique({
      where: { clauseId: clause.id }
    })

    expect(analysis?.riskLevel).toBe("high")
    expect(analysis?.ambiguousLanguage).toContain("any damages")
  })

  it("upsert prevents duplicate analysis on retry", async () => {
    const clause = await prisma.clause.create({
      data: { contractId, content: "Some clause.", orderIndex: 1 }
    })

    // First analysis
    await prisma.clauseAnalysis.upsert({
      where: { clauseId: clause.id },
      create: {
        clauseId: clause.id,
        riskLevel: "low",
        riskExplanation: "Initial analysis.",
        ambiguousLanguage: [],
        recommendations: [],
      },
      update: {
        riskLevel: "high",
        riskExplanation: "Updated analysis on retry.",
        ambiguousLanguage: [],
        recommendations: [],
      }
    })

    // Second upsert (simulating a retry)
    await prisma.clauseAnalysis.upsert({
      where: { clauseId: clause.id },
      create: {
        clauseId: clause.id,
        riskLevel: "low",
        riskExplanation: "Should not create a duplicate.",
        ambiguousLanguage: [],
        recommendations: [],
      },
      update: {
        riskLevel: "high",
        riskExplanation: "Correctly updated.",
        ambiguousLanguage: [],
        recommendations: [],
      }
    })

    const analyses = await prisma.clauseAnalysis.findMany({
      where: { clauseId: clause.id }
    })

    // Should only ever be ONE analysis per clause
    expect(analyses).toHaveLength(1)
    expect(analyses[0].riskLevel).toBe("high")
  })

  it("stores a review token on the contract", async () => {
    const tokenId = "test-token-id-123"

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        reviewToken: tokenId,
        status: "awaiting_review"
      }
    })

    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    })

    expect(contract?.reviewToken).toBe(tokenId)
    expect(contract?.status).toBe("awaiting_review")
  })
})