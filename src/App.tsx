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
  // --- AUTHENTICATION STATE ---
  const [token, setToken] = useState<string | null>(localStorage.getItem("draft_token"));
  const [username, setUsername] = useState<string | null>(localStorage.getItem("draft_user"));
  
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // --- DRAFT STATE ---
  const [question, setQuestion] = useState("")
  const [appState, setAppState] = useState("idle") 
  const [timeLeft, setTimeLeft] = useState(60)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null)
  const [debugError, setDebugError] = useState("")

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if ((appState === "active" || appState === "loading") && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (timeLeft === 0 && appState === "active") {
      setAppState("time-up")
    }
    return () => clearTimeout(timer)
  }, [appState, timeLeft])

  // --- LOGIN & REGISTER LOGIC ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    
    const endpoint = authMode === "login" ? "/login" : "/register";
    
    try {
      const response = await fetch(`https://interview-backend-2-svse.onrender.com${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed");
      }
      
      if (authMode === "register") {
        setAuthMode("login");
        setAuthError("Franchise created! Please log in to the Front Office.");
      } else {
        // Successful Login
        setToken(data.access_token);
        setUsername(data.username);
        localStorage.setItem("draft_token", data.access_token);
        localStorage.setItem("draft_user", data.username);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem("draft_token");
    localStorage.removeItem("draft_user");
    setAppState("idle");
  };

  // --- GENERATE QUESTION LOGIC ---
  const fetchQuestion = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedTopic || !selectedDiff || !token) return;

    setDebugError("");
    setAppState("loading");
    setTimeLeft(60);
    
    try {
      const response = await fetch("https://interview-backend-2-svse.onrender.com/generate_question", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` // Securely send the user's token!
        },
        body: JSON.stringify({
          topic: selectedTopic,
          difficulty: selectedDiff
          // We removed 'history' because PostgreSQL handles it automatically now!
        })
      });
      
      if (response.status === 401) {
        handleLogout();
        alert("Your session expired. Please log in again.");
        return;
      }
      
      if (!response.ok) {
        const errText = await response.text();
        setDebugError(`SERVER REJECTED CONNECTION (${response.status}): ${errText}`);
        setAppState("error");
        return;
      }
      
      const data = await response.json();
      
      if (!data || !data.question) {
        setDebugError("Server returned empty data. Check Render logs.");
        setAppState("error");
        return;
      }

      setQuestion(data.question);
      setAppState("pick-in");
      
      setTimeout(() => {
        setAppState("active");
      }, 2500);
      
    } catch (error: any) {
      setDebugError(`NETWORK CRASH: ${error.message}`);
      setAppState("error");
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `0${m}:${s < 10 ? '0' : ''}${s}`
  }

  // If user is not logged in, show the Login/Register Screen
  if (!token) {
    return (
      <div className="draft-container">
        <div className="draft-header">
          <h1>Data Science Draft</h1>
          <p>Front Office Access</p>
        </div>
        
        <div className="auth-container">
          <form className="auth-card" onSubmit={handleAuth}>
            <h2>{authMode === "login" ? "GM Login" : "Register Franchise"}</h2>
            
            <input 
              className="auth-input"
              type="text" 
              placeholder="Username" 
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              required
            />
            
            <input 
              className="auth-input"
              type="password" 
              placeholder="Password" 
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
            />
            
            {authError && (
              <p style={{ color: authError.includes("created") ? "#10b981" : "#ef4444", marginBottom: "15px" }}>
                {authError}
              </p>
            )}
            
            <button className="auth-button" type="submit" disabled={authLoading}>
              {authLoading ? "Processing..." : (authMode === "login" ? "Enter Draft Room" : "Create Franchise")}
            </button>
            
            <button 
              className="auth-toggle"
              type="button" 
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
              }}
            >
              {authMode === "login" ? "New GM? Register here." : "Already have a franchise? Log in."}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // --- MAIN DRAFT BOARD (Logged In) ---
  const isReady = selectedTopic && selectedDiff;
  let btnText = "Select Position & Level";
  if (selectedTopic && !selectedDiff) btnText = "Select Prospect Level";
  if (!selectedTopic && selectedDiff) btnText = "Select Target Position";
  if (isReady) btnText = "Make The Pick";

  return (
    <div className="draft-container">
      <button className="logout-btn" onClick={handleLogout}>Log Out</button>

      <div className="draft-header">
        <h1>Data Science Draft</h1>
        <p>1st Round Pick</p>
      </div>

      <div className="stage">
        
        {appState !== "idle" && appState !== "error" && (
          <div className={`draft-clock ${timeLeft <= 10 ? 'danger' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        )}

        {appState === "idle" && (
          <>
            <div className="user-greeting">GM {username}'s Draft Board</div>

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
                  type="button"
                  key={diff.id}
                  className={`diff-btn ${selectedDiff === diff.name ? 'selected' : ''}`}
                  onClick={() => setSelectedDiff(diff.name)}
                >
                  {diff.name}
                </button>
              ))}
            </div>

            <button 
              type="button"
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
            
            <button type="button" className="reset-button" onClick={() => {
              setAppState("idle");
              setSelectedTopic(null);
              setSelectedDiff(null);
            }}>
              Next Pick
            </button>
          </div>
        )}

        {appState === "error" && (
          <div className="active-card" style={{ border: "2px solid #ef4444" }}>
            <div className="time-up-banner" style={{ marginBottom: "20px" }}>SYSTEM MALFUNCTION</div>
            <div className="question-box">
              <p style={{ color: "#ef4444", fontWeight: "bold" }}>{debugError}</p>
            </div>
            <button type="button" className="reset-button" onClick={() => setAppState("idle")}>
              Reset & Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default App
