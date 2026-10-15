import { useState, useEffect } from 'react'
import './App.css'

/**
 * Dedicated logger interface.
 * Why: Adheres to clean code standards by eliminating unformatted console statements in production.
 */
const logger = {
  info: (msg: string, ...args: unknown[]) => console.info(`[Draft-UI] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[Draft-UI ERROR] ${msg}`, ...args),
}

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

/**
 * Main application component for the Data Science Draft interview platform.
 * Why: Combines NFL draft theme with GM authentication, question drafting, and PostgreSQL answer persistence.
 */
export function App(): React.JSX.Element {
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

  // --- ANSWER SUBMISSION STATE ---
  const [answer, setAnswer] = useState("")
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [submissionSuccess, setSubmissionSuccess] = useState(false)
  const [submissionId, setSubmissionId] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState("")

  const BACKEND_URL = "https://interview-backend-2-svse.onrender.com"

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if ((appState === "active" || appState === "loading") && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (timeLeft === 0 && appState === "active") {
      setAppState("time-up")
    }
    return () => clearTimeout(timer)
  }, [appState, timeLeft])

  /**
   * Dispatches login or registration request to the backend.
   * Why: Authenticates GM credentials and obtains JWT bearer token.
   */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    
    const endpoint = authMode === "login" ? "/login" : "/register";
    
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed");
      }
      
      if (authMode === "register") {
        setAuthMode("login");
        setAuthError("Franchise created! Please log in to the Front Office.");
      } else {
        setToken(data.access_token);
        setUsername(data.username);
        localStorage.setItem("draft_token", data.access_token);
        localStorage.setItem("draft_user", data.username);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Authentication error"
      logger.error("Auth error:", errMsg)
      setAuthError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Clears GM session state and removes tokens from browser storage.
   * Why: Terminates user session cleanly on logout.
   */
  const handleLogout = () => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem("draft_token");
    localStorage.removeItem("draft_user");
    setAppState("idle");
    setAnswer("");
    setSubmissionSuccess(false);
  };

  /**
   * Requests a new technical question from the backend.
   * Why: Generates innovative questions tailored to position and difficulty while preventing duplicates.
   */
  const fetchQuestion = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedTopic || !selectedDiff || !token) return;

    setDebugError("");
    setAppState("loading");
    setTimeLeft(60);
    setAnswer("");
    setSubmissionSuccess(false);
    setSubmissionId(null);
    setSubmitError("");
    
    try {
      const response = await fetch(`${BACKEND_URL}/generate_question`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          topic: selectedTopic,
          difficulty: selectedDiff
        })
      });
      
      if (response.status === 401) {
        const errText = await response.text();
        handleLogout();
        alert(`Server rejected token: ${errText}`);
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
      
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Network failure"
      logger.error("Question fetch failed:", errMsg)
      setDebugError(`NETWORK CRASH: ${errMsg}`);
      setAppState("error");
    }
  }

  /**
   * Submits the candidate's answer to the PostgreSQL database linked to active GM user_id.
   * Why: Permanently stores evaluation responses for auditing and review in DBeaver.
   */
  const handleSubmitAnswer = async () => {
    const trimmed = answer.trim();
    if (!trimmed) {
      setSubmitError("Please write an answer before submitting.");
      return;
    }

    setIsSubmittingAnswer(true);
    setSubmitError("");

    try {
      logger.info("Submitting answer to PostgreSQL database...");
      const response = await fetch(`${BACKEND_URL}/submit_answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question: question,
          answer: trimmed,
          topic: selectedTopic,
          difficulty: selectedDiff
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || `Server error (${response.status})`);
      }

      setSubmissionSuccess(true);
      setSubmissionId(data.submission_id ?? null);
      logger.info("Answer saved. Submission ID:", data.submission_id);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Submission error"
      logger.error("Answer submission failed:", errMsg)
      setSubmitError(errMsg);
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `0${m}:${s < 10 ? '0' : ''}${s}`
  }

  // --- UN-AUTHENTICATED LOGIN / REGISTER SCREEN ---
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

  // --- MAIN DRAFT BOARD (Logged In GM) ---
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
            
            {/* Answer Input Box & Submit Button */}
            <div className="answer-section" style={{ marginTop: '20px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label 
                  htmlFor="candidate-answer" 
                  style={{ color: '#93c5fd', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}
                >
                  Your Playbook Response:
                </label>
                <span style={{ color: '#64748b', fontSize: '13px' }}>
                  {answer.length} characters
                </span>
              </div>

              <textarea
                id="candidate-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Formulate your detailed technical response here... Discuss mathematical formulation, algorithmic tradeoffs, and edge cases."
                rows={6}
                disabled={isSubmittingAnswer || submissionSuccess}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  lineHeight: '1.6',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={isSubmittingAnswer || !answer.trim() || submissionSuccess}
                  style={{
                    padding: '10px 24px',
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    backgroundColor: submissionSuccess ? '#10b981' : '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSubmittingAnswer || !answer.trim() || submissionSuccess ? 'not-allowed' : 'pointer',
                    opacity: !answer.trim() ? 0.6 : 1,
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  {isSubmittingAnswer 
                    ? '💾 Storing in PostgreSQL...' 
                    : (submissionSuccess ? '✅ Answer Stored in Database' : '🚀 Submit Answer')}
                </button>
              </div>

              {/* Success Badge */}
              {submissionSuccess && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px 16px', 
                  borderRadius: '6px', 
                  backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                  border: '1px solid #10b981', 
                  color: '#34d399', 
                  fontSize: '14px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px' 
                }}>
                  <span>🏈</span>
                  <span>
                    <strong>Submission Confirmed!</strong> Saved in PostgreSQL table <code>question_answers</code> (Record #{submissionId} • GM: {username}).
                  </span>
                </div>
              )}

              {/* Error Notice */}
              {submitError && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px 16px', 
                  borderRadius: '6px', 
                  backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                  border: '1px solid #ef4444', 
                  color: '#f87171', 
                  fontSize: '14px' 
                }}>
                  ⚠️ {submitError}
                </div>
              )}
            </div>

            {appState === "time-up" && (
              <div className="time-up-banner">TIME'S UP. PENCILS DOWN.</div>
            )}
            
            <button 
              type="button" 
              className="reset-button" 
              onClick={() => {
                setAppState("idle");
                setSelectedTopic(null);
                setSelectedDiff(null);
                setAnswer("");
                setSubmissionSuccess(false);
                setSubmissionId(null);
                setSubmitError("");
              }}
            >
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
