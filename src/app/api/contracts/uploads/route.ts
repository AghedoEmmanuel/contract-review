import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { put } from "@vercel/blob"
import prisma from "@/lib/prisma"
import { tasks } from "@trigger.dev/sdk/v3"
import { processContractUpload } from "@/trigger/processContract"

export async function POST(request: Request) {
  try {
    // 1. Check the user is logged in
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be logged in to upload contracts" },
        { status: 401 }
      )
    }

    // 2. Get the file from the request
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // 3. Validate it's a PDF
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 }
      )
    }

    // 4. Validate file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File must be under 10MB" },
        { status: 400 }
      )
    }

    // 5. Get the user from DB
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // 6. Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: "public",
    })

    // 7. Create contract record in DB
    const contract = await prisma.contract.create({
      data: {
        userId: user.id,
        fileName: file.name,
        fileUrl: blob.url,
        status: "processing",
      }
    })

    // 8. Trigger the background task
    await tasks.trigger<typeof processContractUpload>(
      "process-contract-upload",
      { contractId: contract.id, fileUrl: blob.url }
    )

    return NextResponse.json({
      message: "Contract uploaded successfully",
      contractId: contract.id,
    }, { status: 201 })

  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}