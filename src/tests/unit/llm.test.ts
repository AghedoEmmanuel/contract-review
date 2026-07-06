import {describe, it, expect, vi, beforeEach} from "vitest"

// Mock the Google Generative AI module
vi.mock("@google-ai/generativelanguage", () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(()=>({
        getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn(),
        })
    }))
}))

import {GoogleGenerativeAI} from "@google/generative-ai"
import {extractClauses, analyseClause} from "@/lib/llm"

describe("extractClauses",()=>{
    beforeEach(()=>{
        vi.clearAllMocks()
    })

    it("returns an array of clause strings", async()=>{
        const mockClauses=[
            "The Provider shall deliver services within 30 days.",
            "Payment is due within 14 days of invoice.",
            "Either party may terminate with 30 days notice.",
        ]

        //mock the gemini response
        const mockGenerate = vi.fn().mockResolvedValue({
            response: {
            text: () => JSON.stringify(mockClauses),
            },
        })
   const instance = new GoogleGenerativeAI("test-key")
    const model = instance.getGenerativeModel({ model: "gemini-1.5-flash" })
    vi.mocked(model.generateContent).mockImplementation(mockGenerate)

    const result = await extractClauses("Some contract text here")

    expect(result).toBeInstanceOf(Array)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe("The Provider shall deliver services within 30 days.")
  })

  it("handles Gemini returning JSON with markdown backticks", async () => {
    const mockClauses = ["Clause one.", "Clause two."]
    const responseWithBackticks = `\`\`\`json\n${JSON.stringify(mockClauses)}\n\`\`\``

    const mockGenerate = vi.fn().mockResolvedValue({
      response: { text: () => responseWithBackticks },
    })

    const instance = new GoogleGenerativeAI("test-key")
    const model = instance.getGenerativeModel({ model: "gemini-1.5-flash" })
    vi.mocked(model.generateContent).mockImplementation(mockGenerate)

    const result = await extractClauses("Some contract text")

    expect(result).toHaveLength(2)
    expect(result[0]).toBe("Clause one.")
  })

  it("throws if Gemini returns invalid JSON", async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      response: { text: () => "This is not JSON at all" },
    })

    const instance = new GoogleGenerativeAI("test-key")
    const model = instance.getGenerativeModel({ model: "gemini-1.5-flash" })
    vi.mocked(model.generateContent).mockImplementation(mockGenerate)

    await expect(extractClauses("Some text")).rejects.toThrow()
  })
})

describe("analyseClause", () => {
  it("returns a valid analysis object with all required fields", async () => {
    const mockAnalysis = {
      riskLevel: "high",
      riskExplanation: "This clause waives all liability.",
      ambiguousLanguage: ["reasonable efforts", "material adverse change"],
      recommendations: ["Define reasonable efforts specifically."],
    }

    const mockGenerate = vi.fn().mockResolvedValue({
      response: { text: () => JSON.stringify(mockAnalysis) },
    })

    const instance = new GoogleGenerativeAI("test-key")
    const model = instance.getGenerativeModel({ model: "gemini-1.5-flash" })
    vi.mocked(model.generateContent).mockImplementation(mockGenerate)

    const result = await analyseClause(
      "Provider shall not be liable for any damages whatsoever."
    )

    expect(result.riskLevel).toBe("high")
    expect(result.riskExplanation).toBeTruthy()
    expect(result.ambiguousLanguage).toBeInstanceOf(Array)
    expect(result.recommendations).toBeInstanceOf(Array)
  })

  it("riskLevel is one of the three valid values", async () => {
    const mockAnalysis = {
      riskLevel: "medium",
      riskExplanation: "Some risk present.",
      ambiguousLanguage: [],
      recommendations: [],
    }

    const mockGenerate = vi.fn().mockResolvedValue({
      response: { text: () => JSON.stringify(mockAnalysis) },
    })

    const instance = new GoogleGenerativeAI("test-key")
    const model = instance.getGenerativeModel({ model: "gemini-1.5-flash" })
    vi.mocked(model.generateContent).mockImplementation(mockGenerate)

    const result = await analyseClause("Some clause text")

    expect(["high", "medium", "low"]).toContain(result.riskLevel)
  })
})