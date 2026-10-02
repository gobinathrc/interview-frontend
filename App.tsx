import { useState, useEffect } from 'react'
import './App.css'

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

const DIFFICULTIES = [
  { id: "easy", name: "Rookie (Easy)" },
  { id: "medium", name: "Pro-Bowler (Medium)" },
  { id: "hard", name: "Hall of Famer (Hard)" }
]

function App() {
  const [question, setQuestion] = useState("")
  const [appState, setAppState] = useState("idle") 
  const [timeLeft, setTimeLeft] = useState(60)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (appState !== "idle" && appState !== "time-up" && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (timeLeft === 0 && appState !== "idle") {
      setAppState("time-up")
    }
    return () => clearTimeout(timer)
  }, [appState, timeLeft])

  const fetchQuestion = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevents accidental browser page refreshes
    if (!selectedTopic || !selectedDiff) return;

    setAppState("loading")
    setTimeLeft(60)
    
    try {
      const response = await fetch("https://interview-backend-2-svse.onrender.com/generate_question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          difficulty: selectedDiff,
          history: history
        })
      });
      
      // If the server rejects the request (CORS, 404, 502)
      if (!response.ok) {
        const errText = await response.text();
        setQuestion(`SERVER ERROR ${response.status}: ${errText}`);
        setAppState("active");
        return;
      }
      
      const data = await response.json();
      setQuestion(data.question);
      setHistory(prev => [...prev, data.question]);
      
      // Flash "The Pick is In"
      setAppState("pick-in");
      
      // Wait 2.5 seconds, then reveal the question
      setTimeout(() => {
        setAppState(prev => prev === "time-up" ? "time-up" : "active");
      }, 2500);
      
    } catch (error: any) {
      // If the network completely drops, freeze on the active screen and show the error
      setQuestion(`NETWORK CRASH: ${error.message}. Is your backend deployed?`);
      setAppState("active");
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `0${m}:${s < 10 ? '0' : ''}${s}`
  }

  const isReady = selectedTopic && selectedDiff;
  let btnText = "Select Position & Level";
  if (selectedTopic && !selectedDiff) btnText = "Select Prospect Level";
  if (!selectedTopic && selectedDiff) btnText = "Select Target Position";
  if (isReady) btnText = "Make The Pick";

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

            <div className="draft-board-title">Prospect Level (Difficulty)</div>
            <div className="difficulty-board">
              {DIFFICULTIES.map(diff => (
                <button
                  key={diff.id}
                  className={`diff-btn ${selectedDiff === diff.name ? 'selected' : ''}`}
                  onClick={() => setSelectedDiff(diff.name)}
                >
                  {diff.name}
                </button>
              ))}
            </div>

            <button 
              className="draft-button" 
              onClick={fetchQuestion}
              disabled={!isReady}
              style={{ opacity: isReady ? 1 : 0.5 }}
            >
              {btnText}
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
              <div style={{ color: '#1d4ed8', fontWeight: 'bold', marginBottom: '15px', textTransform: 'uppercase' }}>
                SCOUTING REPORT: {selectedTopic} ({selectedDiff})
              </div>
              <p>{question}</p>
            </div>
            
            {appState === "time-up" && (
              <div className="time-up-banner">TIME'S UP. PENCILS DOWN.</div>
            )}
            
            <button className="reset-button" onClick={() => {
              setAppState("idle");
              setSelectedTopic(null);
              setSelectedDiff(null);
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
