import {task,logger} from "@trigger.dev/sdk/v3"
import prisma from "@/lib/prisma";
import {analyseClause as analyseClauseWithLLM} from "@/lib/llm";

export const analyseClauseTask = task({
    id: "analyseClause",
    queue:{
        concurrencyLimit:10,
    },
    retry:{
        maxAttempts:3,
        factor:2,
        minTimeoutInMs: 2000,
    },
    run: async (payload: {clauseId:string; content:string})=>{
        const {clauseId, content} = payload;

        logger.info("Analsing Clause",{clauseId})

        const analysis = await analyseClauseWithLLM(content)

        logger.info("Analysis complete",{
            clauseId,
            riskLevel:analysis.riskLevel,
        })

        await prisma.clauseAnalysis.upsert({
            where:{clauseId},
            create:{
                clauseId,
                riskLevel: analysis.riskLevel,
                riskExplanation: analysis.riskExplanation,
                ambiguousLanguage: analysis.ambiguousLanguage,
                recommendations: analysis.recommendations,
            },
            update:{
                riskLevel: analysis.riskLevel,
                riskExplanation: analysis.riskExplanation,
                ambiguousLanguage: analysis.ambiguousLanguage,
                recommendations: analysis.recommendations,
            }
        })

        return {clauseId, riskLevel: analysis.riskLevel}
    }
})