'use client'

import { useRouter } from "next/navigation"
import { useState } from "react"


const LoginPage = () => {

    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

  return (
    <div></div>
  )
}

export default LoginPage
