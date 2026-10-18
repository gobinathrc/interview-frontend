import { useState, useEffect } from 'react'
import './App.css'

const logger = {
  info: (msg: string, ...args: unknown[]) => console.info(`[Draft-UI] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[Draft-UI ERROR] ${msg}`, ...args),
}

const DRAFT_BOARD = [
  { id: 1, icon: "🛡️", pos: "OL", nfl: "The Offensive Line",  ds: "SQL & Data Engineering" },
  { id: 2, icon: "⚡", pos: "CB", nfl: "Scouting Combine",    ds: "Descriptive Stats & EDA" },
  { id: 3, icon: "🚩", pos: "HC", nfl: "Coaches' Challenge",  ds: "Inferential Stats & Hypotheses" },
  { id: 4, icon: "📋", pos: "OC", nfl: "The Playbook",        ds: "Supervised Machine Learning" },
  { id: 5, icon: "🔒", pos: "FS", nfl: "Zone Coverage",       ds: "Unsupervised & Anomaly Detection" },
  { id: 6, icon: "⏱️", pos: "ST", nfl: "Clock Management",    ds: "Time Series & Forecasting" },
  { id: 7, icon: "🏈", pos: "QB", nfl: "The Franchise QB",    ds: "Deep Learning (DL)" },
  { id: 8, icon: "📢", pos: "DC", nfl: "Audibles & Calling",  ds: "NLP & Generative AI" },
  { id: 9, icon: "🏢", pos: "GM", nfl: "The Front Office",    ds: "MLOps & System Architecture" }
]

const DIFFICULTIES = [
  { id: "easy",   name: "Rookie (Easy)",           title: "Rookie",         sub: "Foundations" },
  { id: "medium", name: "Pro-Bowler (Medium)",     title: "Pro-Bowler",     sub: "Production Depth" },
  { id: "hard",   name: "Hall of Famer (Hard)",    title: "Hall of Famer",  sub: "Architectural Rigor" }
]

interface EvaluationResponse {
  status: string
  submission_id?: number
  score?: number
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
    gid = "guest_" + Math.random().toString(36).substring(2, 8)
    localStorage.setItem("draft_guest_id", gid)
  }
  return gid
}

function getScoreMeta(score: number): { color: string; barColor: string; grade: string; emoji: string } {
  if (score >= 90) return { color: '#10b981', barColor: '#10b981', grade: 'S — Elite First-Round Lock', emoji: '🏆' }
  if (score >= 70) return { color: '#38bdf8', barColor: '#38bdf8', grade: 'A — Starter Grade',          emoji: '🏈' }
  if (score >= 50) return { color: '#f59e0b', barColor: '#f59e0b', grade: 'B — Practice Squad',         emoji: '⚠️' }
  if (score >= 25) return { color: '#f97316', barColor: '#f97316', grade: 'C — Training Camp',          emoji: '📋' }
  return                { color: '#f43f5e', barColor: '#f43f5e', grade: 'D — Cut Day Risk',            emoji: '🛑' }
}

function ScoreGauge({ score }: { score: number }) {
  const meta = getScoreMeta(score)
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '14px 0 6px' }}>
      <svg width="124" height="124" viewBox="0 0 124 124">
        <circle cx="62" cy="62" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="62" cy="62" r={radius}
          fill="none"
          stroke={meta.barColor}
          strokeWidth="10"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 62 62)"
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        <text x="62" y="58" textAnchor="middle" fill="#f8fafc" fontSize="28" fontWeight="900" fontFamily="Plus Jakarta Sans, sans-serif">{score}</text>
        <text x="62" y="76" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">OUT OF 100</text>
      </svg>
      <div style={{ color: meta.color, fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em', marginTop: '6px' }}>
        {meta.emoji} {meta.grade}
      </div>
    </div>
  )
}

export function App(): React.JSX.Element {
  // --- AUTH & GUEST STATE ---
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
  const [selectedTopic, setSelectedTopic] = useState<string | null>("SQL & Data Engineering")
  const [selectedDiff, setSelectedDiff] = useState<string | null>("Rookie (Easy)")
  const [debugError, setDebugError] = useState("")

  // --- 3-ATTEMPT & SCORING EVALUATION STATE ---
  const [answer, setAnswer] = useState("")
  const [attempt, setAttempt] = useState<number>(1)
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [feedback, setFeedback] = useState<string>("")
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
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || "Authentication failed")

      if (authMode === "register") {
        setAuthMode("login")
        setAuthError("Franchise established! Please sign in with your GM credentials.")
      } else {
        setToken(data.access_token)
        setUsername(data.username)
        setIsGuest(false)
        localStorage.setItem("draft_token", data.access_token)
        localStorage.setItem("draft_user", data.username)
        localStorage.removeItem("draft_mode")
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Authentication error"
      logger.error("Auth error:", errMsg)
      setAuthError(errMsg)
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
    resetRoundState()
  }

  const resetRoundState = () => {
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
    resetRoundState()

    try {
      const response = await fetch(`${BACKEND_URL}/generate_question`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          topic: selectedTopic,
          difficulty: selectedDiff
        })
      })

      if (response.status === 401 && token) {
        const errText = await response.text()
        handleLogout()
        alert(`Server rejected token: ${errText}`)
        return
      }

      if (!response.ok) {
        const errText = await response.text()
        setDebugError(`SERVER REJECTED CONNECTION (${response.status}): ${errText}`)
        setAppState("error")
        return
      }

      const data = await response.json()
      if (!data || !data.question) {
        setDebugError("Server returned empty data. Check Render logs.")
        setAppState("error")
        return
      }

      setQuestion(data.question)
      setAppState("pick-in")
      setTimeout(() => setAppState("active"), 2000)
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Network failure"
      logger.error("Question fetch failed:", errMsg)
      setDebugError(`NETWORK CRASH: ${errMsg}`)
      setAppState("error")
    }
  }

  const handleSubmitAnswer = async () => {
    const trimmed = answer.trim()
    if (!trimmed) {
      setSubmitError("Please write your technical formulation before submitting.")
      return
    }

    setIsSubmittingAnswer(true)
    setSubmitError("")

    try {
      logger.info(`Evaluating candidate answer for attempt ${attempt} of 3...`)
      const response = await fetch(`${BACKEND_URL}/submit_answer`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          question: question,
          answer: trimmed,
          attempt: attempt,
          topic: selectedTopic,
          difficulty: selectedDiff
        })
      })

      const data: EvaluationResponse = await response.json()
      if (!response.ok) {
        throw new Error((data as unknown as { detail?: string }).detail || "Evaluation request failed.")
      }

      const receivedScore = typeof data.score === 'number' ? data.score : (data.is_correct ? 85 : 45)
      setScore(receivedScore)
      setIsCorrect(data.is_correct)
      setFeedback(data.feedback)

      if (data.is_correct) {
        setIdealAnswer(data.ideal_answer || null)
      } else {
        if (attempt < 3) {
          setAttempt(prev => prev + 1)
        } else {
          setIdealAnswer(data.ideal_answer || null)
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Submission error"
      logger.error("Answer evaluation failed:", errMsg)
      setSubmitError(errMsg)
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `0${m}:${s < 10 ? '0' : ''}${s}`
  }

  const isRoundFinished = isCorrect === true || (isCorrect === false && attempt >= 3 && idealAnswer !== null)
  const isAuthenticatedOrGuest = Boolean(token || isGuest)

  // ─── AUTH SCREEN (GLASSMORPHIC WAR ROOM) ───
  if (!isAuthenticatedOrGuest) {
    return (
      <div className="draft-container" style={{ minHeight: '90vh', justifyContent: 'center' }}>
        <div className="draft-header">
          <h1>NFL Data Science Combine</h1>
          <div className="headline-tag">Front Office Scouting & AI Evaluation Terminal</div>
        </div>

        <div style={{
          width: '100%', maxWidth: '420px',
          background: 'var(--bg-surface)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-subtle)', borderRadius: '16px',
          padding: '32px', boxShadow: '0 25px 60px rgba(0,0,0,0.7)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 18px', textAlign: 'center', color: '#f8fafc', letterSpacing: '0.04em' }}>
            {authMode === "login" ? "GM FRANCHISE ACCESS" : "REGISTER FRANCHISE"}
          </h2>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="text"
              placeholder="Franchise Username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              required
              style={{
                width: '100%', boxSizing: 'border-box', padding: '13px 16px',
                borderRadius: '8px', background: 'rgba(10, 15, 29, 0.8)',
                border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '14px'
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              style={{
                width: '100%', boxSizing: 'border-box', padding: '13px 16px',
                borderRadius: '8px', background: 'rgba(10, 15, 29, 0.8)',
                border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '14px'
              }}
            />

            {authError && (
              <div style={{ fontSize: '13px', color: authError.includes("established") ? '#34d399' : '#fb7185', textAlign: 'center' }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="primary-draft-btn"
              style={{ minWidth: '100%', padding: '14px' }}
            >
              {authLoading ? "Authenticating..." : (authMode === "login" ? "Enter War Room" : "Create Franchise")}
            </button>

            <button
              type="button"
              onClick={() => { setAuthMode(m => m === "login" ? "register" : "login"); setAuthError("") }}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}
            >
              {authMode === "login" ? "Need a franchise? Register here." : "Already have a franchise? Log in."}
            </button>
          </form>

          <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
            <button
              type="button"
              onClick={handleContinueAsGuest}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#38bdf8', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ⚡ Continue as Guest Scout (PostgreSQL Synced)
            </button>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
              Your answers, 0-100 scores, and strengths profile persist seamlessly.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── MAIN WAR ROOM DASHBOARD ───
  const isReady = selectedTopic && selectedDiff
  let btnText = "Select Position & Level"
  if (selectedTopic && !selectedDiff) btnText = "Select Prospect Level"
  if (!selectedTopic && selectedDiff) btnText = "Select Target Position"
  if (isReady) btnText = "Make The Pick"

  return (
    <div className="draft-container">
      {/* ── TOP NAV STATUS BAR ── */}
      <div className="war-room-nav">
        <div className="status-badge">
          <span className="live-dot" />
          <span>COMBINE LIVE • POSTGRESQL SYNCED</span>
        </div>

        <div className="nav-actions">
          <button type="button" className="scouting-pill-btn" onClick={fetchScoutingReport}>
            📊 {reportLoading ? "Scouting..." : "Scouting Report"}
          </button>
          <button type="button" className="exit-pill-btn" onClick={handleLogout}>
            {token ? `Log Out (${username})` : `Exit Guest [${guestId.substring(0, 8)}]`}
          </button>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div className="draft-header">
        <h1>NFL Data Science Draft Combine</h1>
        <div className="headline-tag">
          {token ? `GM ${username} • Front Office Command` : `Guest Scout [${guestId}] • Candidate Assessment`}
        </div>
      </div>

      {/* ── PERSONALIZED SCOUTING REPORT MODAL ── */}
      {showReport && scoutingReport && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(3, 7, 18, 0.88)', zIndex: 9999,
          backdropFilter: 'blur(16px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0c1322', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '16px',
            maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
            padding: '28px', color: '#f8fafc', boxShadow: '0 25px 60px rgba(0,0,0,0.85)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#38bdf8', fontWeight: 800 }}>📋 Candidate Scouting Profile</h2>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Evaluated Candidate: {scoutingReport.candidate}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
              <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Overall Combine Score</div>
                <div style={{ fontSize: '30px', fontWeight: 900, color: scoutingReport.overall_avg_score >= 70 ? '#34d399' : '#fbbf24', marginTop: '4px' }}>
                  {scoutingReport.overall_avg_score}<span style={{ fontSize: '16px', color: '#64748b' }}>/100</span>
                </div>
              </div>
              <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Graded Responses</div>
                <div style={{ fontSize: '30px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
                  {scoutingReport.total_answers}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.3)', borderRadius: '10px', padding: '14px 18px', marginBottom: '22px' }}>
              <div style={{ fontWeight: 800, color: '#93c5fd', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                🎯 Head Coach Directive:
              </div>
              <div style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: 1.5 }}>{scoutingReport.recommendation}</div>
            </div>

            {/* Strengths */}
            <div style={{ marginBottom: '22px' }}>
              <h3 style={{ fontSize: '13px', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                💪 Core Strengths (Average Score ≥ 70)
              </h3>
              {scoutingReport.strengths.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b' }}>No verified strengths yet. Score 70+ in a topic to feature here.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scoutingReport.strengths.map(s => (
                    <div key={s.topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '10px 14px', borderRadius: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.topic}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 700 }}>{s.grade}</span>
                        <span style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 900 }}>
                          {s.avg_score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weaknesses */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '13px', color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                ⚠️ Target Weaknesses (Average Score &lt; 70)
              </h3>
              {scoutingReport.weaknesses.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b' }}>No weaknesses identified. Solid performance across the board.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scoutingReport.weaknesses.map(w => (
                    <div key={w.topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)', padding: '10px 14px', borderRadius: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{w.topic}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#fb7185', fontWeight: 700 }}>{w.grade}</span>
                        <span style={{ backgroundColor: '#881337', color: '#fecdd3', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 900 }}>
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
              className="primary-draft-btn"
              style={{ width: '100%', padding: '12px' }}
            >
              Return to War Room
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE ── */}
      <div className="stage">
        {appState !== "idle" && appState !== "error" && (
          <div className={`draft-clock ${timeLeft <= 10 ? 'danger' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        )}

        {appState === "idle" && (
          <>
            {/* Target Position */}
            <div className="section-headline">
              <span>Target Position on the Board</span>
            </div>

            <div className="draft-board-grid">
              {DRAFT_BOARD.map((item) => (
                <div
                  key={item.id}
                  className={`prospect-card ${selectedTopic === item.ds ? 'selected' : ''}`}
                  onClick={() => setSelectedTopic(item.ds)}
                >
                  <div className="card-top-row">
                    <span className="card-icon">{item.icon}</span>
                    <span className="card-pos-tag">{item.pos}</span>
                  </div>
                  <div className="nfl-title">{item.nfl}</div>
                  <div className="ds-subtitle">{item.ds}</div>
                </div>
              ))}
            </div>

            {/* Prospect Level */}
            <div className="section-headline">
              <span>Prospect Level (Difficulty)</span>
            </div>

            <div className="difficulty-selector">
              {DIFFICULTIES.map(diff => (
                <button
                  type="button"
                  key={diff.id}
                  data-level={diff.id}
                  className={`diff-pill ${selectedDiff === diff.name ? 'selected' : ''}`}
                  onClick={() => setSelectedDiff(diff.name)}
                >
                  <span className="diff-title">{diff.title}</span>
                  <span className="diff-sub">{diff.sub}</span>
                </button>
              ))}
            </div>

            {/* CTA */}
            <div className="cta-wrapper">
              <button
                type="button"
                className="primary-draft-btn"
                onClick={fetchQuestion}
                disabled={!isReady}
              >
                {btnText}
              </button>
            </div>
          </>
        )}

        {appState === "loading" && (
          <div className="loading-banner">
            WAR ROOM IS ON THE CLOCK...
          </div>
        )}

        {appState === "pick-in" && (
          <div className="pick-is-in-banner">
            THE PICK IS IN
          </div>
        )}

        {/* ── ACTIVE DRILL CARD ── */}
        {(appState === "active" || appState === "time-up") && (
          <div className="active-card">
            <div className="question-box">
              <div className="question-meta-row">
                <span className="drill-topic-label">
                  DRILL: {selectedTopic} ({selectedDiff})
                </span>
                <span
                  className="try-pill"
                  style={{
                    backgroundColor: isCorrect === true ? '#10b981' : (isCorrect === false ? '#f59e0b' : '#2563eb')
                  }}
                >
                  {isRoundFinished ? 'EVALUATION COMPLETE' : `TRY ${attempt} OF 3`}
                </span>
              </div>
              <p className="question-text">{question}</p>
            </div>

            {/* Response Section */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label
                  htmlFor="candidate-answer"
                  style={{ color: '#93c5fd', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                >
                  Your Playbook Response:
                </label>
                <span style={{ color: '#64748b', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                  {answer.length} CHARS
                </span>
              </div>

              <textarea
                id="candidate-answer"
                className="response-textarea"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Formulate your detailed technical response here... Discuss mathematical foundations, algorithmic trade-offs, and edge cases."
                rows={6}
                disabled={isSubmittingAnswer || isRoundFinished}
                style={{
                  border: isCorrect === true ? '2px solid #10b981' : (isCorrect === false ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.12)')
                }}
              />

              {!isRoundFinished && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="primary-draft-btn"
                    onClick={handleSubmitAnswer}
                    disabled={isSubmittingAnswer || !answer.trim()}
                    style={{ minWidth: 'auto', padding: '12px 24px', fontSize: '14px' }}
                  >
                    {isSubmittingAnswer
                      ? 'AI Judge Scoring...'
                      : (isCorrect === false ? `Try Again (Attempt ${attempt} of 3)` : `Submit Answer (Attempt ${attempt} of 3)`)}
                  </button>
                </div>
              )}

              {/* ── 0 / 100 GAUGE ── */}
              {score !== null && (
                <div style={{
                  marginTop: '18px',
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(10, 15, 29, 0.85)',
                  border: isCorrect ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Attempt {isCorrect ? attempt : (attempt > 1 ? attempt - 1 : 1)} Performance Rating
                  </div>
                  <ScoreGauge score={score} />
                </div>
              )}

              {/* Feedback Banners */}
              {isCorrect === true && (
                <div style={{ marginTop: '16px', padding: '16px 20px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', color: '#34d399', fontSize: '14px' }}>
                  <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>🎯 TOUCHDOWN! ANSWER PASSED (SCORE ≥ 70)</div>
                  <div>{feedback}</div>
                </div>
              )}

              {isCorrect === false && !isRoundFinished && (
                <div style={{ marginTop: '16px', padding: '16px 20px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid #f59e0b', color: '#fbbf24', fontSize: '14px' }}>
                  <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>⚠️ INCOMPLETE ({4 - attempt} tries remaining)</div>
                  <div style={{ marginBottom: '6px' }}>{feedback}</div>
                  <div style={{ fontSize: '12px', color: '#fde68a' }}>💡 <em>Coaching Hint: Review the feedback above, refine your playbook response, and click Try Again!</em></div>
                </div>
              )}

              {isCorrect === false && isRoundFinished && (
                <div style={{ marginTop: '16px', padding: '16px 20px', borderRadius: '10px', backgroundColor: 'rgba(244, 63, 94, 0.12)', border: '1px solid #f43f5e', color: '#fb7185', fontSize: '14px' }}>
                  <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>❌ TURNOVER ON DOWNS (All 3 Tries Used)</div>
                  <div>{feedback}</div>
                </div>
              )}

              {/* Canonical Ideal Answer Card */}
              {idealAnswer && (
                <div style={{ marginTop: '16px', padding: '18px 22px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#f8fafc', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
                  <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    📖 The Canonical Playbook Solution:
                  </div>
                  <div style={{ fontSize: '15px', lineHeight: 1.7, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                    {idealAnswer}
                  </div>
                </div>
              )}

              {submitError && (
                <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(244, 63, 94, 0.15)', border: '1px solid #f43f5e', color: '#fb7185', fontSize: '13px' }}>
                  ⚠️ {submitError}
                </div>
              )}
            </div>

            {appState === "time-up" && (
              <div style={{ color: '#f43f5e', fontWeight: 800, margin: '20px 0', fontSize: '18px' }}>TIME'S UP. PENCILS DOWN.</div>
            )}

            <button
              type="button"
              className="reset-button"
              onClick={() => {
                setAppState("idle")
                setSelectedTopic("SQL & Data Engineering")
                setSelectedDiff("Rookie (Easy)")
                resetRoundState()
              }}
            >
              Next Combine Pick
            </button>
          </div>
        )}

        {appState === "error" && (
          <div className="active-card" style={{ border: "2px solid #f43f5e" }}>
            <div style={{ color: '#f43f5e', fontWeight: 800, fontSize: '20px', marginBottom: '14px' }}>SYSTEM MALFUNCTION</div>
            <div className="question-box">
              <p style={{ color: '#fb7185', fontWeight: 600 }}>{debugError}</p>
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
