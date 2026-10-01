import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [question, setQuestion] = useState("")
  // The app goes through 5 stages: idle -> loading -> pick-in -> active -> time-up
  const [appState, setAppState] = useState("idle") 
  const [timeLeft, setTimeLeft] = useState(60)

  // This effect handles the 60 second countdown clock
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (appState === "active" && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (appState === "active" && timeLeft === 0) {
      setAppState("time-up")
    }
    return () => clearTimeout(timer)
  }, [appState, timeLeft])

  const fetchQuestion = async () => {
    setAppState("loading")
    try {
      const response = await fetch("https://interview-backend-2-svse.onrender.com/generate_question")
      const data = await response.json()
      setQuestion(data.question)
      
      // Stage 1: Flash "THE PICK IS IN"
      setAppState("pick-in")
      
      // Stage 2: Wait 3 seconds, then reveal the question and start the clock!
      setTimeout(() => {
        setAppState("active")
        setTimeLeft(60) // Set clock to 60 seconds
      }, 3000)
      
    } catch (error) {
      console.error("Failed to fetch:", error)
      setQuestion("Error connecting to backend.")
      setAppState("idle")
    }
  }

  // Helper to make the clock look like a real digital timer (01:00, 00:59, etc)
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `0${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="draft-container">
      
      {/* Stadium Header */}
      <div className="draft-header">
        <h1>Data Science Draft</h1>
        <p>1st Round Pick</p>
      </div>

      {/* Main Draft Stage */}
      <div className="stage">
        
        {/* State: Idle or Loading */}
        {(appState === "idle" || appState === "loading") && (
          <button 
            className={`draft-button ${appState === "loading" ? "loading" : ""}`}
            onClick={fetchQuestion}
            disabled={appState === "loading"}
          >
            {appState === "loading" ? "Team is on the clock..." : "Make The Pick"}
          </button>
        )}

        {/* State: The Pick is In (Dramatic Transition) */}
        {appState === "pick-in" && (
          <div className="pick-is-in-banner">
            <div className="flash-text">THE PICK IS IN</div>
          </div>
        )}

        {/* State: Active Question and Clock Running */}
        {(appState === "active" || appState === "time-up") && (
          <div className="active-card">
            
            {/* The Countdown Clock */}
            <div className={`draft-clock ${timeLeft <= 10 ? 'danger' : ''}`}>
              {formatTime(timeLeft)}
            </div>
            
            {/* The Question Card */}
            <div className="question-box">
              <p>{question}</p>
            </div>
            
            {/* Time's Up Message */}
            {appState === "time-up" && (
              <div className="time-up-banner">TIME'S UP. PENCILS DOWN.</div>
            )}
            
            {/* Reset Button */}
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
