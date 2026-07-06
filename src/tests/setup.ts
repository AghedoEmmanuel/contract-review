import {beforeAll, afterAll, beforeEach} from "vitest"
import { PrismaClient } from "@prisma/client"
import {execSync} from "child_process"
import * as dotenv from "dotenv"
import path from "path"


dotenv.config({ path: path.resolve(process.cwd(), ".env.test") })
console.log("DEBUG: process.env.DATABASE_URL is currently:", process.env.DATABASE_URL)

process.env.DATABASE_URL ="postgresql://postgres:postgres@localhost:5433/contract_review_test"
const prisma = new PrismaClient()

beforeAll(async () => {
  // Push schema to test database before all tests
  execSync("npx prisma db push --force-reset", { 
    env:{
        ...process.env,
        DATABASE_URL:process.env.DATABASE_URL
    }
   })
})

beforeEach(async()=>{
    // Clean all tables before each test so tests don't interfere with each other
    await prisma.reviewDecision.deleteMany()
    await prisma.clauseAnalysis.deleteMany()
    await prisma.clause.deleteMany()
    await prisma.contract.deleteMany()
    await prisma.user.deleteMany()
    await prisma.session.deleteMany()
})

afterAll(async () => {
    await prisma.$disconnect()
})