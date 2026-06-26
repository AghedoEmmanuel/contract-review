import { task, logger } from "@trigger.dev/sdk/v3";
import { PDFParse } from "pdf-parse";
import prisma from "@/lib/prisma";

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

    logger.info("Contract processing complete", { contractId });

    return {
      contractId,
      pages: textResult.pages?.length ?? 0,
      characters: extractedText.length,
    };
  },
});