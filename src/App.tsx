import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [question, setQuestion] = useState("")
  const [appState, setAppState] = useState("idle") 
  const [timeLeft, setTimeLeft] = useState(60)

  // Timer now runs the moment we leave "idle"
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (appState !== "idle" && appState !== "time-up" && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (timeLeft === 0 && appState !== "idle") {
      setAppState("time-up")
    }
    return () => clearTimeout(timer)
  }, [appState, timeLeft])

  const fetchQuestion = async () => {
    setAppState("loading")
    setTimeLeft(60) // Start the clock immediately!
    
    try {
      const response = await fetch("https://interview-backend-2-svse.onrender.com/generate_question")
      const data = await response.json()
      setQuestion(data.question)
      
      setAppState("pick-in")
      
      setTimeout(() => {
        // Prevent revealing if time already ran out while waiting
        setAppState(prev => prev === "time-up" ? "time-up" : "active")
      }, 3000)
      
    } catch (error) {
      console.error("Failed to fetch:", error)
      setQuestion("Error connecting to backend.")
      setAppState("idle")
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `0${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="draft-container">
      
      <div className="draft-header">
        <h1>Data Science Draft</h1>
        <p>1st Round Pick</p>
      </div>

      <div className="stage">
        
        {/* The Clock is now permanently visible while drafting! */}
        {appState !== "idle" && (
          <div className={`draft-clock ${timeLeft <= 10 ? 'danger' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        )}

        {appState === "idle" && (
          <button className="draft-button" onClick={fetchQuestion}>
            Make The Pick
          </button>
        )}

        {appState === "loading" && (
          <div className="loading-banner">
            TEAM IS ON THE CLOCK...
          </div>
        )}

        {appState === "pick-in" && (
          <div className="pick-is-in-banner">
            <div className="flash-text">THE PICK IS IN</div>
          </div>
        )}

        {(appState === "active" || appState === "time-up") && (
          <div className="active-card">
            
            <div className="question-box">
              <p>{question}</p>
            </div>
            
            {appState === "time-up" && (
              <div className="time-up-banner">TIME'S UP. PENCILS DOWN.</div>
            )}
            
            <button className="reset-button" onClick={() => setAppState("idle")}>
              Next Pick
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default App
