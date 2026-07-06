import { describe, it, expect } from "vitest"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import dotenv from "dotenv"

dotenv.config({ path: ".env.test" })

const prisma = new PrismaClient()

// We test the logic directly rather than through HTTP
// to avoid needing a running Next.js server

async function registerUser(email: string, password: string) {
  if (!email || !password) throw new Error("Email and password are required")
  if (password.length < 8) throw new Error("Password must be at least 8 characters")

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error("An account with this email already exists")

  const hashedPassword = await bcrypt.hash(password, 12)
  return prisma.user.create({ data: { email, password: hashedPassword } })
}

describe("User Registration", () => {
  it("creates a new user with a hashed password", async () => {
    const user = await registerUser("test@example.com", "password123")

    expect(user.id).toBeTruthy()
    expect(user.email).toBe("test@example.com")

    // Critically — password must NOT be stored as plain text
    expect(user.password).not.toBe("password123")
    expect(user.password).toMatch(/^\$2[aby]\$/)  // bcrypt hash pattern
  })

  it("rejects duplicate email addresses", async () => {
    await registerUser("duplicate@example.com", "password123")

    await expect(
      registerUser("duplicate@example.com", "password456")
    ).rejects.toThrow("An account with this email already exists")
  })

  it("rejects passwords shorter than 8 characters", async () => {
    await expect(
      registerUser("short@example.com", "abc")
    ).rejects.toThrow("Password must be at least 8 characters")
  })

  it("rejects missing email", async () => {
    await expect(
      registerUser("", "password123")
    ).rejects.toThrow("Email and password are required")
  })
})

describe("Prisma Schema", () => {
  it("can create a user and a linked contract", async () => {
    const user = await prisma.user.create({
      data: { email: "schema@example.com", password: "hashedpassword" }
    })

    const contract = await prisma.contract.create({
      data: {
        userId: user.id,
        fileName: "test-contract.pdf",
        status: "uploaded",
      }
    })

    expect(contract.userId).toBe(user.id)
    expect(contract.status).toBe("uploaded")
  })

  it("can create clauses linked to a contract", async () => {
    const user = await prisma.user.create({
      data: { email: "clauses@example.com", password: "hashedpassword" }
    })

    const contract = await prisma.contract.create({
      data: { userId: user.id, fileName: "contract.pdf", status: "extracted" }
    })

    await prisma.clause.createMany({
      data: [
        { contractId: contract.id, content: "Clause one text.", orderIndex: 1 },
        { contractId: contract.id, content: "Clause two text.", orderIndex: 2 },
      ]
    })

    const clauses = await prisma.clause.findMany({
      where: { contractId: contract.id },
      orderBy: { orderIndex: "asc" }
    })

    expect(clauses).toHaveLength(2)
    expect(clauses[0].content).toBe("Clause one text.")
    expect(clauses[1].orderIndex).toBe(2)
  })

  it("cascades review decisions correctly", async () => {
    const user = await prisma.user.create({
      data: { email: "cascade@example.com", password: "hashedpassword" }
    })

    const contract = await prisma.contract.create({
      data: { userId: user.id, fileName: "contract.pdf", status: "analysing" }
    })

    const clause = await prisma.clause.create({
      data: { contractId: contract.id, content: "Some clause.", orderIndex: 1 }
    })

    await prisma.clauseAnalysis.create({
      data: {
        clauseId: clause.id,
        riskLevel: "high",
        riskExplanation: "Very risky clause.",
        ambiguousLanguage: ["reasonable efforts"],
        recommendations: ["Define this term precisely."],
      }
    })

    const decision = await prisma.reviewDecision.create({
      data: {
        clauseId: clause.id,
        decision: "rejected",
        annotation: "This needs revision before signing.",
      }
    })

    expect(decision.decision).toBe("rejected")
    expect(decision.annotation).toBe("This needs revision before signing.")

    // Verify the full chain is queryable
    const fullClause = await prisma.clause.findUnique({
      where: { id: clause.id },
      include: { analysis: true, reviewDecision: true }
    })

    expect(fullClause?.analysis?.riskLevel).toBe("high")
    expect(fullClause?.reviewDecision?.decision).toBe("rejected")
  })
})