import Link from "next/link"


const HomePage = () => {
  return (
    <div className="min-h-screen p-8">

      <nav className="flex items-center justify-between border-b">
      <span className="text-xl font-bold text-blue-600">Contract Review AI</span>
      <div className="flex space-x-4">
        <Link href='/login' className="text-gray-600 hover:text-grey-900">Sign In</Link>
        <Link href='/signup' className="text-gray-600 hover:text-grey-900">Get Started</Link>
      </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-40 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">AI-Powered Contract Review</h1>
        <p className="text-xl text-gray-500 mb-8 mx-auto max-w-2xl">Upload any contract and get a detailed risk analysis in minutes.
          Our AI identifies risky clauses, ambiguous language, and missing
          terms, then incorporates your feedback into a final report.
        </p>
        <Link href='/signup' className="inline-block px-8 py-4 bg-blue-600 text-white text-lg rounded-md hover:bg-blue-900">Start Reviewing Contracts</Link>

        <div className="mt-20 md:grid grid-cols-3 gap-8 text-left space-y-6 md:space-y-0">
          {[
            {
              title: "Parallel Analysis",
              desc: "Every clause analysed simultaneously, not one by one. Results in minutes not hours."
            },
            {
              title: "Human in the Loop",
              desc: "AI does the first pass. You review, approve, or annotate. Final report combines both."
            },
            {
              title: "Any LLM Provider",
              desc: "Works with OpenAI, Anthropic, or any other provider. Switch without changing code."
            }
          ].map((feature) => (
            <div key={feature.title} className="p-6 border rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2">{feature.title}</h3>
              <p className="text-gray-300 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
      
    </div>
  )
}

export default HomePage
