import { useState } from 'react'
import './App.css'

function App() {
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)

  const fetchQuestion = async () => {
    setLoading(true)
    try {
      const response = await fetch("https://interview-backend-2-svse.onrender.com/generate_question")
      const data = await response.json()
      setQuestion(data.question)
    }
    catch (error){
      console.error("Failed to fetch:", error)
      setQuestion("Error connecting to backend. Make sure your Python server is running.")
    }
    setLoading(false)
  }

  return (
    <div className="app-container">
      
      <h1 className="title">First Round Pick Prep</h1>
      <p className="subtitle">Generate highly challenging interview questions.</p>
      
      <button
        className="draft-button"
        onClick={fetchQuestion}
        disabled={loading}
      >
        {loading ? "Reviewing the playbook..." : "Draft Next Question"}
      </button>
      
      {question && (
        <div className="question-box">
          <p className="question-text">{question}</p>
        </div>
      )}
      
    </div>
  )
}

export default App
