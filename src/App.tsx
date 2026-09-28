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
      setQuestion("Error connecting to backend. Make sure your Python server is running")
    }
    setLoading(false)
  }
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
      
      <h1>The Locker Room Interview</h1>
      <p style={{ color: "#d71e1e", marginBottom: "40px" }}>Generate highly challenging interview questions.</p>
      
      <button
        type="button"
        className="counter"
        onClick={fetchQuestion}
        disabled={loading}
        style={{ padding: "14px 28px", fontSize: "18px", cursor: "pointer", borderRadius: "8px" }}
      >
        {loading ? " Reviewing the playbook..." : "🏈 Draft Next Question"}
      </button>
      
      {question && (
        <div style={{ marginTop: "40px", padding: "30px", backgroundColor: "#153015", borderRadius: "12px", border: "2px solid #2ea043", textAlign: "left", boxShadow: "0 4px 6px rgba(234, 87, 87, 0.3)" }}>
          <p style={{ whiteSpace: "pre-wrap", color: "white", margin: 0, fontSize: "18px", lineHeight: "1.7" }}>
            {question}
          </p>
        </div>
      )}
      
    </div>
  )
}
export default App
