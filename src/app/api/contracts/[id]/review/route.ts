import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { wait } from "@trigger.dev/sdk/v3"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
){
    try{
        const session = await auth()
        if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorised" },
        { status: 401 }
      )
    }

    const { id } = await params
    const contractId = id

    const contract = await prisma.contract.findUnique({
        where:{id:contractId},
        include:{user:true}
    })

    if (!contract || contract.user.email !== session.user.email){
         return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      )
    }

    if (!contract.reviewToken){
         return NextResponse.json(
        { error: "The contract is not awaiting review" },
        { status: 400 }
      )
    }

    const {decisions} = await request.json() as {
        decisions: {clauseId: string; decision:"approved"|"rejected"; annotation?:string}[]
    }

    if(!decisions || decisions.length === 0){
        return NextResponse.json(
            {error: "No decisions provided"},
            {status: 400}
        )
    }

    // save all decisions to the database first - this is our source of truth
    await prisma.$transaction(
        decisions.map((d) =>
            prisma.reviewDecision.upsert({
                where:{clauseId:d.clauseId },
                create: {
                    clauseId: d.clauseId,
                    decision: d.decision,
                    annotation: d.annotation,
                },
                update:{
                    decision:d.decision,
                    annotation:d.annotation,
                }
            })
        )
    )

    //complete the waitpoint token - this resumes the suspended trigger.dev task
    await wait.completeToken(contract.reviewToken,{
        reviewedBy:session.user.email,
        completedAt:new Date().toISOString(),
    })

    return NextResponse.json({message: "Review successfully submitted"})
    }
    catch(error){
        console.error("Review submission error:", error)
        return NextResponse.json(
            {error: "Something went wrong"},
            {status:500}
        )
    }
}