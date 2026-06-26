import {GoogleGenerativeAI} from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY!
);

const model = genAI.getGenerativeModel({model:"gemini-1.5-flash"})

export async function extractClauses(text:string): Promise<string[]>{
    const prompt = `
You are a legal document analyst. Your job is to split a contract into its individual clauses.

Rules:
- Each clause must be a complete, self-contained unit of meaning
- Do not split mid-sentence
- Remove page numbers, headers, footers, and formatting artifacts
- Return ONLY a JSON array of strings, nothing else
- No markdown, no backticks, no explanation — just the raw JSON array

Example output format:
["Clause text here", "Another clause here", "Third clause here"]

Contract text to split:
${text}
`

const result = await model.generateContent(prompt)
const response = result.response.text()

//Parse the JSON array Gemini returns
const cleaned = response.replace(/```json|```/g, "").trim()
const clauses: string[] = JSON.parse(cleaned)
return clauses
}