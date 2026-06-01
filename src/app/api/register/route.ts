import {NextResponse} from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request){
    try{
        const {email,password} = await request.json()

        if(!email || !password || typeof email !== "string" || typeof password !== "string"){
            return NextResponse.json(
                {error: "Email and password are required"},
                {status:400}
            )
        }

        if (password.length < 8){
            return NextResponse.json(
                {error: "Password must be at least 8 characters"},
                {status:400}
            )
        }

        const existingUser = await prisma.user.findUnique({
            where: {email}
        })

        if (existingUser){
            return NextResponse.json(
                {error: "User already exists"},
                {status:400}
            )
        }

        const hashedPassword = await bcrypt.hash(password,12)

        const user = await prisma.user.create({
            data:{email,password:hashedPassword}
        })

        return NextResponse.json(
                {message: "Account created successfully", userId:user.id},
                {status:201}
            )
    } catch (error){
        return NextResponse.json(
            {error: "Something went wrong", details: error instanceof Error ? error.message : "Unknown error"},
            {status:500}
            )
    }
}