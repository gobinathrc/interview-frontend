import { useState, useEffect } from 'react'
import './App.css'

// The 9 Topics mapped to NFL Concepts
const DRAFT_BOARD = [
  { id: 1, nfl: "The Offensive Line", ds: "SQL & Data Engineering" },
  { id: 2, nfl: "Scouting Combine", ds: "Descriptive Stats & EDA" },
  { id: 3, nfl: "Coaches' Challenge", ds: "Inferential Stats & Hypothesis Testing" },
  { id: 4, nfl: "The Playbook", ds: "Supervised Machine Learning" },
  { id: 5, nfl: "Zone Coverage", ds: "Unsupervised ML & Anomaly Detection" },
  { id: 6, nfl: "Clock Management", ds: "Time Series & Forecasting" },
  { id: 7, nfl: "The Franchise QB", ds: "Deep Learning (DL)" },
  { id: 8, nfl: "Audibles & Calling", ds: "NLP & Generative AI" },
  { id: 9, nfl: "The Front Office", ds: "MLOps & Production" }
]

function App() {
  const [question, setQuestion] = useState("")
  const [appState, setAppState] = useState("idle") 
  const [timeLeft, setTimeLeft] = useState(60)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)

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
    if (!selectedTopic) return; // Prevent drafting without a topic

    setAppState("loading")
    setTimeLeft(60)
    
    try {
      // Pass the selected topic in the URL to Python
      const url = `https://interview-backend-2-svse.onrender.com/generate_question?topic=${encodeURIComponent(selectedTopic)}`
      const response = await fetch(url)
      const data = await response.json()
      setQuestion(data.question)
      
      setAppState("pick-in")
      setTimeout(() => {
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
        
        {appState !== "idle" && (
          <div className={`draft-clock ${timeLeft <= 10 ? 'danger' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        )}

        {/* Show the Draft Board ONLY when idle */}
        {appState === "idle" && (
          <>
            <div className="draft-board-title">Target Position on the Board</div>
            <div className="draft-board">
              {DRAFT_BOARD.map((item) => (
                <div 
                  key={item.id} 
                  className={`prospect-card ${selectedTopic === item.ds ? 'selected' : ''}`}
                  onClick={() => setSelectedTopic(item.ds)}
                >
                  <div className="nfl-theme">{item.nfl}</div>
                  <div className="ds-theme">{item.ds}</div>
                </div>
              ))}
            </div>

            <button 
              className="draft-button" 
              onClick={fetchQuestion}
              disabled={!selectedTopic}
              style={{ opacity: selectedTopic ? 1 : 0.5 }}
            >
              {selectedTopic ? "Make The Pick" : "Select a Position First"}
            </button>
          </>
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
              {/* Show which topic was picked */}
              <div style={{ color: '#1d4ed8', fontWeight: 'bold', marginBottom: '15px', textTransform: 'uppercase' }}>
                SCOUTING REPORT: {selectedTopic}
              </div>
              <p>{question}</p>
            </div>
            
            {appState === "time-up" && (
              <div className="time-up-banner">TIME'S UP. PENCILS DOWN.</div>
            )}
            
            <button className="reset-button" onClick={() => {
              setAppState("idle")
              setSelectedTopic(null)
            }}>
              Next Pick
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default App
