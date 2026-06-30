import { task, logger, wait } from "@trigger.dev/sdk/v3";
import { PDFParse } from "pdf-parse";
import prisma from "@/lib/prisma";
import { extractClauses } from "@/lib/llm"
import { analyseClauseTask } from "./analyseClause";
import {sendReviewNotification} from "@/lib/email";

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

    

    logger.info("Parallel analysis complete")

    // step 4 : Aggregate the result

    const fullContract = await prisma.contract.findUniqueOrThrow({
      where:{id: contractId},
      include:{
        clauses:{include:{analysis:true}},
        user:true,
      }
    })

    const highRiskCount = fullContract.clauses.filter( c => c.analysis?.riskLevel === "high").length
    const mediumRiskCount = fullContract.clauses.filter( c => c.analysis?.riskLevel === "medium").length
    const lowRiskCount = fullContract.clauses.filter( c => c.analysis?.riskLevel === "low").length

    logger.info("Report aggregated",{
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
    })

    await prisma.contract.update({
      where: {id: contractId},
      data: {status: "awaiting_review"}
    })

  
    //step 5 : Create the waitpoint token

    logger.info("Creating waitpoint token")

    const token = await wait.createToken({
      timeout: "7d",
    })

    await prisma.contract.update({
      where: {id:contractId},
      data: {reviewToken: token.id}
    })

    logger.info("Waitpoint token created", {tokenId: token.id})

    //step 6 : send email notification

    await sendReviewNotification({
      to: fullContract.user.email,
      contractName: fullContract.fileName,
      contractId: fullContract.id,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
    })

    logger.info("Review notification sent", {to: fullContract.user.email})

    // ── Step 7: suspend and wait for human review ─────────────────────

    logger.info("Task suspending - waiting for human review")

    const result = await wait.forToken<{
      reviewedBy: string,
      completedAt: string
    }>(token)

    // ⏸️ Execution paused here until someone calls wait.completeToken()
    // This could be seconds, hours, or days later.
    // When it resumes, `result.output` contains whatever data was passed in.

     if (!result.ok) {
      logger.error("Review token timed out or failed", { contractId })
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "review_timed_out" }
      })
      return { contractId, status: "review_timed_out" }
    }

    logger.info("Review completed, task resumed", {
      contractId,
      reviewedBy: result.output.reviewedBy,
    })

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "reviewed" }
    })

//     logger.info("All done", { contractId })

    return {
      contractId,
      status: "reviewed",
      reviewedBy: result.output.reviewedBy,
    }
  }
});