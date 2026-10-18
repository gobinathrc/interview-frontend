import { useState, useEffect } from 'react'
import './App.css'

const logger = {
  info: (msg: string, ...args: unknown[]) => console.info(`[Draft-UI] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[Draft-UI ERROR] ${msg}`, ...args),
}

const DRAFT_BOARD = [
  { id: 1, nfl: "The Offensive Line",  ds: "SQL & Data Engineering" },
  { id: 2, nfl: "Scouting Combine",    ds: "Descriptive Stats & EDA" },
  { id: 3, nfl: "Coaches' Challenge",  ds: "Inferential Stats & Hypothesis Testing" },
  { id: 4, nfl: "The Playbook",        ds: "Supervised Machine Learning" },
  { id: 5, nfl: "Zone Coverage",       ds: "Unsupervised ML & Anomaly Detection" },
  { id: 6, nfl: "Clock Management",    ds: "Time Series & Forecasting" },
  { id: 7, nfl: "The Franchise QB",    ds: "Deep Learning (DL)" },
  { id: 8, nfl: "Audibles & Calling",  ds: "NLP & Generative AI" },
  { id: 9, nfl: "The Front Office",    ds: "MLOps & Production" }
]

const DIFFICULTIES = [
  { id: "easy",   name: "Rookie (Easy)" },
  { id: "medium", name: "Pro-Bowler (Medium)" },
  { id: "hard",   name: "Hall of Famer (Hard)" }
]

interface EvaluationResponse {
  status: string
  submission_id?: number
  score: number
  is_correct: boolean
  feedback: string
  attempt: number
  attempts_left: number
  ideal_answer?: string | null
}

interface StrengthWeaknessItem {
  topic: string
  avg_score: number
  grade: string
  attempts: number
}

interface ScoutingReport {
  candidate: string
  total_answers: number
  overall_avg_score: number
  strengths: StrengthWeaknessItem[]
  weaknesses: StrengthWeaknessItem[]
  topic_breakdown: Record<string, { avg_score: number; attempts: number; pass_rate: number; highest_score: number }>
  recommendation: string
}

function getOrCreateGuestId(): string {
  let gid = localStorage.getItem("draft_guest_id")
  if (!gid) {
    gid = "guest_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36)
    localStorage.setItem("draft_guest_id", gid)
  }
  return gid
}

function getScoreMeta(score: number): { color: string; barColor: string; grade: string; emoji: string } {
  if (score >= 90) return { color: '#10b981', barColor: '#10b981', grade: 'S — Elite First-Round Lock', emoji: '🏆' }
  if (score >= 70) return { color: '#3b82f6', barColor: '#3b82f6', grade: 'A — Starter Grade',          emoji: '🏈' }
  if (score >= 50) return { color: '#f59e0b', barColor: '#f59e0b', grade: 'B — Practice Squad',         emoji: '⚠️' }
  if (score >= 25) return { color: '#f97316', barColor: '#f97316', grade: 'C — Training Camp',          emoji: '📋' }
  return                { color: '#ef4444', barColor: '#ef4444', grade: 'D — Cut Day Risk',            emoji: '🛑' }
}

/** Animated score arc/gauge component */
function ScoreGauge({ score }: { score: number }) {
  const meta = getScoreMeta(score)
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '15px 0' }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={radius}
          fill="none"
          stroke={meta.barColor}
          strokeWidth="10"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="65" y="60" textAnchor="middle" fill="#f8fafc" fontSize="28" fontWeight="800">{score}</text>
        <text x="65" y="78" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600">/ 100</text>
      </svg>
      <div style={{ color: meta.color, fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>
        {meta.emoji} {meta.grade}
      </div>
    </div>
  )
}

export function App(): React.JSX.Element {
  // --- AUTH & GUEST IDENTITY ---
  const [token, setToken] = useState<string | null>(localStorage.getItem("draft_token"))
  const [username, setUsername] = useState<string | null>(localStorage.getItem("draft_user"))
  const [isGuest, setIsGuest] = useState<boolean>(!localStorage.getItem("draft_token") && localStorage.getItem("draft_mode") === "guest")
  const [guestId] = useState<string>(getOrCreateGuestId)

  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [authUsername, setAuthUsername] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [authLoading, setAuthLoading] = useState(false)

  // --- DRAFT STATE ---
  const [question, setQuestion] = useState("")
  const [appState, setAppState] = useState("idle")
  const [timeLeft, setTimeLeft] = useState(60)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null)
  const [debugError, setDebugError] = useState("")

  // --- SCORING & EVALUATION STATE ---
  const [answer, setAnswer] = useState("")
  const [attempt, setAttempt] = useState(1)
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [feedback, setFeedback] = useState("")
  const [idealAnswer, setIdealAnswer] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState("")

  // --- PERSONALIZATION & SCOUTING REPORT ---
  const [scoutingReport, setScoutingReport] = useState<ScoutingReport | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  const BACKEND_URL = "https://interview-backend-2-svse.onrender.com"

  const getHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    } else {
      headers["x-guest-id"] = guestId
    }
    return headers
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if ((appState === "active" || appState === "loading") && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (timeLeft === 0 && appState === "active") {
      setAppState("time-up")
    }
    return () => clearTimeout(timer)
  }, [appState, timeLeft])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    setAuthLoading(true)
    const endpoint = authMode === "login" ? "/login" : "/register"
    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Authentication failed")
      if (authMode === "register") {
        setAuthMode("login")
        setAuthError("Franchise created! Please log in to the Front Office.")
      } else {
        setToken(data.access_token)
        setUsername(data.username)
        setIsGuest(false)
        localStorage.setItem("draft_token", data.access_token)
        localStorage.setItem("draft_user", data.username)
        localStorage.removeItem("draft_mode")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication error"
      logger.error("Auth:", msg)
      setAuthError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleContinueAsGuest = () => {
    setIsGuest(true)
    setToken(null)
    setUsername(null)
    localStorage.setItem("draft_mode", "guest")
  }

  const handleLogout = () => {
    setToken(null)
    setUsername(null)
    setIsGuest(false)
    localStorage.removeItem("draft_token")
    localStorage.removeItem("draft_user")
    localStorage.removeItem("draft_mode")
    setAppState("idle")
    resetRound()
  }

  const resetRound = () => {
    setAnswer("")
    setAttempt(1)
    setScore(null)
    setIsCorrect(null)
    setFeedback("")
    setIdealAnswer(null)
    setSubmitError("")
  }

  const fetchQuestion = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedTopic || !selectedDiff) return
    setDebugError("")
    setAppState("loading")
    setTimeLeft(60)
    resetRound()

    try {
      const res = await fetch(`${BACKEND_URL}/generate_question`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ topic: selectedTopic, difficulty: selectedDiff })
      })
      if (res.status === 401 && token) {
        handleLogout()
        alert("Session expired. Please log in again.")
        return
      }
      if (!res.ok) {
        const t = await res.text()
        setDebugError(`SERVER ERROR (${res.status}): ${t}`)
        setAppState("error")
        return
      }
      const data = await res.json()
      if (!data?.question) {
        setDebugError("Server returned empty question.")
        setAppState("error")
        return
      }
      setQuestion(data.question)
      setAppState("pick-in")
      setTimeout(() => setAppState("active"), 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network failure"
      logger.error("Fetch question:", msg)
      setDebugError(`NETWORK CRASH: ${msg}`)
      setAppState("error")
    }
  }

  const handleSubmitAnswer = async () => {
    const trimmed = answer.trim()
    if (!trimmed) {
      setSubmitError("Please write an answer before submitting.")
      return
    }
    setIsSubmittingAnswer(true)
    setSubmitError("")

    try {
      logger.info(`Submitting attempt ${attempt}/3...`)
      const res = await fetch(`${BACKEND_URL}/submit_answer`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          question,
          answer: trimmed,
          attempt,
          topic: selectedTopic || "General Data Science",
          difficulty: selectedDiff || "Starter"
        })
      })
      const data: EvaluationResponse = await res.json()
      if (!res.ok) throw new Error((data as unknown as { detail?: string }).detail || "Evaluation failed")

      // Always set score from backend, fallback to 45 if not returned
      const receivedScore = typeof data.score === 'number' ? data.score : (data.is_correct ? 80 : 45)
      setScore(receivedScore)
      setIsCorrect(data.is_correct)
      setFeedback(data.feedback)

      if (data.is_correct || attempt >= 3) {
        setIdealAnswer(data.ideal_answer || null)
      }
      if (!data.is_correct && attempt < 3) {
        setAttempt(prev => prev + 1)
      }
      logger.info(`Score received: ${receivedScore}/100 | Correct: ${data.is_correct} | Next Attempt: ${attempt + 1}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission error"
      logger.error("Submit answer:", msg)
      setSubmitError(msg)
    } finally {
      setIsSubmittingAnswer(false)
    }
  }

  const fetchScoutingReport = async () => {
    setReportLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/analytics/scouting_report`, {
        headers: getHeaders()
      })
      if (res.ok) {
        const data: ScoutingReport = await res.json()
        setScoutingReport(data)
        setShowReport(true)
      }
    } catch (err) {
      logger.error("Failed to load scouting report:", err)
    } finally {
      setReportLoading(false)
    }
  }

  const formatTime = (s: number) => `0${Math.floor(s / 60)}:${(s % 60 < 10 ? '0' : '')}${s % 60}`
  const isRoundFinished = isCorrect === true || (isCorrect === false && attempt >= 3)
  const isAuthenticatedOrGuest = Boolean(token || isGuest)

  // ─── LOGIN / GUEST SCREEN ───────────────────────────────────────────────────
  if (!isAuthenticatedOrGuest) {
    return (
      <div className="draft-container">
        <div className="draft-header">
          <h1>NFL Data Science Draft Combine</h1>
          <p>Front Office Evaluation & Personalization Engine</p>
        </div>
        <div className="auth-container">
          <form className="auth-card" onSubmit={handleAuth}>
            <h2>{authMode === "login" ? "GM Front Office Login" : "Register New Franchise"}</h2>
            <input className="auth-input" type="text" placeholder="Username" value={authUsername} onChange={e => setAuthUsername(e.target.value)} required />
            <input className="auth-input" type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required />
            {authError && <p style={{ color: authError.includes("created") ? "#10b981" : "#ef4444", marginBottom: "15px" }}>{authError}</p>}
            <button className="auth-button" type="submit" disabled={authLoading}>
              {authLoading ? "Processing..." : authMode === "login" ? "Enter Draft Room" : "Create Franchise"}
            </button>
            <button className="auth-toggle" type="button" onClick={() => { setAuthMode(m => m === "login" ? "register" : "login"); setAuthError("") }}>
              {authMode === "login" ? "New GM? Register here." : "Already have a franchise? Log in."}
            </button>

            <div style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={handleContinueAsGuest}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px',
                  backgroundColor: '#1e293b', border: '1px solid #475569', color: '#94a3b8',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                🏈 Continue as Guest Scout (Stored in DB)
              </button>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                Your guest questions, submissions, and strength/weakness stats persist in PostgreSQL.
              </div>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ─── MAIN DRAFT BOARD ───────────────────────────────────────────────────────
  const isReady = selectedTopic && selectedDiff
  let btnText = "Select Position & Level"
  if (selectedTopic && !selectedDiff) btnText = "Select Prospect Level"
  if (!selectedTopic && selectedDiff) btnText = "Select Target Position"
  if (isReady) btnText = "Make The Pick"

  return (
    <div className="draft-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1000px', margin: '0 auto 15px' }}>
        <button
          type="button"
          onClick={fetchScoutingReport}
          style={{
            background: '#1e293b', border: '1px solid #3b82f6', color: '#60a5fa',
            padding: '8px 16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer'
          }}
        >
          {reportLoading ? 'Loading Profile...' : '📊 Scouting Report (Strengths & Weaknesses)'}
        </button>
        <button className="logout-btn" onClick={handleLogout}>
          {token ? "Log Out" : "Exit Guest Mode"}
        </button>
      </div>

      <div className="draft-header">
        <h1>NFL Data Science Draft Combine</h1>
        <p>{token ? `GM ${username}'s Front Office` : `Guest Scout [${guestId.substring(0, 11)}] (PostgreSQL Synced)`}</p>
      </div>

      {/* ── PERSONALIZED SCOUTING REPORT MODAL ── */}
      {showReport && scoutingReport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0f172a', border: '2px solid #3b82f6', borderRadius: '14px',
            maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
            padding: '24px', color: '#f8fafc', boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#60a5fa' }}>📋 Prospect Scouting Report</h2>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Evaluated Candidate: {scoutingReport.candidate}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <div style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Overall Average</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: scoutingReport.overall_avg_score >= 70 ? '#10b981' : '#f59e0b' }}>
                  {scoutingReport.overall_avg_score}/100
                </div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Answers Graded</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#38bdf8' }}>
                  {scoutingReport.total_answers}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid #2563eb', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, color: '#93c5fd', fontSize: '13px', textTransform: 'uppercase', marginBottom: '4px' }}>
                🎯 Head Coach Directive:
              </div>
              <div style={{ fontSize: '14px', color: '#e2e8f0' }}>{scoutingReport.recommendation}</div>
            </div>

            {/* Strengths */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', color: '#34d399', textTransform: 'uppercase', marginBottom: '8px' }}>
                💪 Core Strengths (Score ≥ 70)
              </h3>
              {scoutingReport.strengths.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b' }}>No verified strengths yet. Score 70+ in a topic to place it here.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scoutingReport.strengths.map(s => (
                    <div key={s.topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '6px' }}>
                      <span style={{ fontWeight: 600 }}>{s.topic}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>{s.grade}</span>
                        <span style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>
                          {s.avg_score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weaknesses */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', color: '#f87171', textTransform: 'uppercase', marginBottom: '8px' }}>
                ⚠️ Target Weaknesses (Score &lt; 70)
              </h3>
              {scoutingReport.weaknesses.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b' }}>No current weaknesses recorded! Great consistency.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scoutingReport.weaknesses.map(w => (
                    <div key={w.topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '6px' }}>
                      <span style={{ fontWeight: 600 }}>{w.topic}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 700 }}>{w.grade}</span>
                        <span style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>
                          {w.avg_score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowReport(false)}
              style={{ width: '100%', padding: '12px', backgroundColor: '#2563eb', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Back to Combine Drills
            </button>
          </div>
        </div>
      )}

      <div className="stage">
        {appState !== "idle" && appState !== "error" && (
          <div className={`draft-clock ${timeLeft <= 10 ? 'danger' : ''}`}>{formatTime(timeLeft)}</div>
        )}

        {/* ── IDLE ── */}
        {appState === "idle" && (
          <>
            <div className="user-greeting">
              {token ? `GM ${username}'s Draft Board` : `Guest Combine Scout (${guestId.substring(0, 11)})`}
            </div>
            <div className="draft-board-title">Target Position on the Board</div>
            <div className="draft-board">
              {DRAFT_BOARD.map(item => (
                <div key={item.id} className={`prospect-card ${selectedTopic === item.ds ? 'selected' : ''}`} onClick={() => setSelectedTopic(item.ds)}>
                  <div className="nfl-theme">{item.nfl}</div>
                  <div className="ds-theme">{item.ds}</div>
                </div>
              ))}
            </div>
            <div className="draft-board-title">Prospect Level (Difficulty)</div>
            <div className="difficulty-board">
              {DIFFICULTIES.map(d => (
                <button type="button" key={d.id} className={`diff-btn ${selectedDiff === d.name ? 'selected' : ''}`} onClick={() => setSelectedDiff(d.name)}>{d.name}</button>
              ))}
            </div>
            <button type="button" className="draft-button" onClick={fetchQuestion} disabled={!isReady} style={{ opacity: isReady ? 1 : 0.5 }}>{btnText}</button>
          </>
        )}

        {appState === "loading" && <div className="loading-banner">WAR ROOM IS ON THE CLOCK...</div>}
        {appState === "pick-in" && <div className="pick-is-in-banner"><div className="flash-text">THE PICK IS IN</div></div>}

        {/* ── ACTIVE / TIME-UP ── */}
        {(appState === "active" || appState === "time-up") && (
          <div className="active-card">
            <div className="question-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ color: '#1d4ed8', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px' }}>
                  SCOUTING DRILL: {selectedTopic} ({selectedDiff})
                </div>
                <div style={{
                  background: isCorrect === true ? '#10b981' : isCorrect === false ? '#f59e0b' : '#3b82f6',
                  color: '#fff', fontSize: '12px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px'
                }}>
                  {isRoundFinished ? 'EVALUATION COMPLETE' : `TRY ${attempt} OF 3`}
                </div>
              </div>
              <p>{question}</p>
            </div>

            {/* Answer input */}
            <div style={{ marginTop: '16px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label htmlFor="candidate-answer" style={{ color: '#93c5fd', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Your Playbook Response:
                </label>
                <span style={{ color: '#64748b', fontSize: '12px' }}>{answer.length} characters</span>
              </div>

              <textarea
                id="candidate-answer"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Formulate your detailed technical response here..."
                rows={6}
                disabled={isSubmittingAnswer || isRoundFinished}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '8px',
                  border: isCorrect === true ? '2px solid #10b981' : isCorrect === false ? '2px solid #f59e0b' : '1px solid #334155',
                  backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '15px',
                  fontFamily: 'inherit', lineHeight: '1.6', outline: 'none', resize: 'vertical'
                }}
              />

              {!isRoundFinished && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={isSubmittingAnswer || !answer.trim()}
                    style={{
                      padding: '10px 24px', fontSize: '15px', fontWeight: 'bold',
                      color: '#fff', backgroundColor: '#2563eb', border: 'none', borderRadius: '6px',
                      cursor: isSubmittingAnswer || !answer.trim() ? 'not-allowed' : 'pointer',
                      opacity: !answer.trim() ? 0.6 : 1, transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(37,99,235,0.35)'
                    }}
                  >
                    {isSubmittingAnswer
                      ? '⏱️ AI Grading...'
                      : isCorrect === false
                        ? `🚀 Try Again (Attempt ${attempt} of 3)`
                        : `🚀 Submit Answer (Attempt ${attempt} of 3)`}
                  </button>
                </div>
              )}

              {/* ── SCORE GAUGE: PROMINENTLY DISPLAYED ON SUBMISSION ── */}
              {score !== null && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  border: isCorrect ? '1px solid #10b981' : '1px solid #f59e0b',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Attempt {isCorrect ? attempt : (attempt > 1 ? attempt - 1 : 1)} Performance Rating
                  </div>
                  <ScoreGauge score={score} />
                </div>
              )}

              {/* ── FEEDBACK BANNERS ── */}
              {isCorrect === true && (
                <div style={{ marginTop: '16px', padding: '14px 18px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#34d399', fontSize: '14px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }}>🎯 TOUCHDOWN! ANSWER PASSED (SCORE ≥ 70)</div>
                  <div>{feedback}</div>
                </div>
              )}

              {isCorrect === false && !isRoundFinished && (
                <div style={{ marginTop: '16px', padding: '14px 18px', borderRadius: '8px', backgroundColor: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', color: '#fbbf24', fontSize: '14px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '6px' }}>⚠️ INCOMPLETE ({3 - attempt + 1} attempts remaining)</div>
                  <div style={{ marginBottom: '8px' }}>{feedback}</div>
                  <div style={{ fontSize: '13px', color: '#fde68a' }}>💡 <em>Coaching Hint: Review the feedback above, refine your answer in the box, and click Try Again!</em></div>
                </div>
              )}

              {isCorrect === false && isRoundFinished && (
                <div style={{ marginTop: '16px', padding: '14px 18px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#f87171', fontSize: '14px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }}>❌ TURNOVER ON DOWNS (All 3 Tries Used)</div>
                  <div>{feedback}</div>
                </div>
              )}

              {/* ── IDEAL ANSWER REVEAL ── */}
              {idealAnswer && (
                <div style={{ marginTop: '16px', padding: '16px 20px', borderRadius: '10px', backgroundColor: 'rgba(30,41,59,0.85)', border: '1px solid #3b82f6', color: '#f8fafc', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }}>
                  <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                    📖 The Ideal Playbook Solution:
                  </div>
                  <div style={{ fontSize: '15px', lineHeight: '1.7', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{idealAnswer}</div>
                </div>
              )}

              {submitError && (
                <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#f87171', fontSize: '14px' }}>
                  ⚠️ {submitError}
                </div>
              )}
            </div>

            {appState === "time-up" && <div className="time-up-banner">TIME'S UP. PENCILS DOWN.</div>}

            <button type="button" className="reset-button" onClick={() => { setAppState("idle"); setSelectedTopic(null); setSelectedDiff(null); resetRound() }}>
              Next Combine Pick
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {appState === "error" && (
          <div className="active-card" style={{ border: "2px solid #ef4444" }}>
            <div className="time-up-banner" style={{ marginBottom: "20px" }}>SYSTEM MALFUNCTION</div>
            <div className="question-box"><p style={{ color: "#ef4444", fontWeight: "bold" }}>{debugError}</p></div>
            <button type="button" className="reset-button" onClick={() => setAppState("idle")}>Reset & Try Again</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
