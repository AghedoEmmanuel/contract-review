import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || typeof credentials.email !== "string" || typeof credentials.password !== "string") return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!passwordMatch) return null;

        return { id: user.id, email: user.email }
      }
    })
  ],

  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  }
});
