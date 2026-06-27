import { task, logger } from "@trigger.dev/sdk/v3";
import { PDFParse } from "pdf-parse";
import prisma from "@/lib/prisma";
import { extractClauses } from "@/lib/llm"
import { analyseClauseTask } from "./analyseClause";

export const processContractUpload = task({
  id: "process-contract-upload",

  //retry up to 3 times if something fails
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    randomize: true,
  },
  run: async (payload: { contractId: string; fileUrl: string }) => {
    const { contractId, fileUrl } = payload;

    logger.info("Starting contract processing", { contractId });

    //1. Updated status to show we've started
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "extracting" },
    });

    //2. Fetch the PDF from Vercel Blob
    logger.info("Fetching PDF from storage", { fileUrl });
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    //3. Extract text from PDF
    logger.info("Extracting text from PDF");
    const pdfParser = new PDFParse({ data: buffer });
    const textResult = await pdfParser.getText();
    const extractedText = textResult.text ?? "";

    logger.info("Text extracted", {
      pages: textResult.pages?.length ?? 0,
      characters: extractedText.length,
    });

    //4. Store extracted text and update status
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        extractedText,
        status: "extracted",
      },
    });

    // ── Step 2: Split into clauses using Gemini ────────────────

    logger.info("Sending text to Gemini for clause extraction")

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "extracting_clauses" }
    })

    const clauses = await extractClauses(extractedText)

    await prisma.clause.deleteMany({where:{contractId}})

    const savedClauses = await prisma.$transaction(
      clauses.map((content,i)=>prisma.clause.create({
        data:{contractId,content,orderIndex: i+1}
      }))
    )

    logger.info("Clauses saved", { count: savedClauses.length })

    // ── Step 3: analyse all contracts in parallel ───────────────

    logger.info("Starting parallel clause analysis", {
      clauseCount: savedClauses.length
    })

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "analysing" }
    })

    // This is the key line — fan out to all clauses simultaneously
    const results = await analyseClauseTask.batchTriggerAndWait(
      savedClauses.map((clause) => ({
        payload: {
          clauseId: clause.id,
          content: clause.content,
        }
      }))
    )

    const successful = results.runs.filter(r => r.ok).length
    const failed = results.runs.filter(r => !r.ok).length

    logger.info("Parallel analysis complete", { successful, failed })

    // ── Step 4: update final status ─────────────────────

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "analysis_complete" }
    })

    logger.info("All done", { contractId })

    return {
      contractId,
      clauseCount: savedClauses.length,
      successful,
      failed,
    }
  }
});