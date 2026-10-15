import React, { useState, useEffect } from 'react'

/**
 * Dedicated production logger interface.
 * Why: Adheres to clean code standards by eliminating unformatted console statements in production.
 */
const logger = {
  info: (msg: string, ...args: unknown[]) => console.info(`[DS-Draft INFO] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[DS-Draft WARN] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[DS-Draft ERROR] ${msg}`, ...args),
}

interface AuthResponse {
  access_token: string
  username: string
  user_id: number
  message?: string
}

interface QuestionResponse {
  question: string
  question_id?: number
  topic?: string
  difficulty?: string
}

interface SubmissionResponse {
  status: string
  message: string
  submission_id?: number
  username?: string
  user_id?: number | null
  created_at?: string
}

/**
 * Main application component for the Data Science Draft interview platform.
 * Why: Unifies user authentication, historical question drafting, and candidate answer persistence.
 */
export function App(): React.JSX.Element {
  // Session State
  const [token, setToken] = useState<string>('')
  const [currentUser, setCurrentUser] = useState<string>('')
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false)
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false)
  const [authUsername, setAuthUsername] = useState<string>('')
  const [authPassword, setAuthPassword] = useState<string>('')
  const [authError, setAuthError] = useState<string>('')
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false)

  // Interview & Drafting State
  const [topic, setTopic] = useState<string>('Machine Learning & AI')
  const [difficulty, setDifficulty] = useState<string>('Starter')
  const [question, setQuestion] = useState<string>('')
  const [answer, setAnswer] = useState<string>('')
  const [isLoadingQuestion, setIsLoadingQuestion] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionResponse | null>(null)

  const BACKEND_URL = 'https://interview-backend-2-svse.onrender.com'

  // Restore authenticated session from localStorage on initial render
  useEffect(() => {
    const savedToken = localStorage.getItem('draft_token')
    const savedUser = localStorage.getItem('draft_username')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setCurrentUser(savedUser)
      logger.info('Restored authenticated session for:', savedUser)
    }
  }, [])

  /**
   * Clears authentication session from memory and browser storage.
   * Why: Terminates user session securely on client logout.
   */
  const handleSignOut = (): void => {
    localStorage.removeItem('draft_token')
    localStorage.removeItem('draft_username')
    setToken('')
    setCurrentUser('')
    logger.info('User signed out')
  }

  /**
   * Handles user login or registration against the FastAPI backend.
   * Why: Manages JWT credentials and stores identity for relational question/answer auditing.
   */
  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setAuthError('')
    setIsAuthLoading(true)

    const endpoint = isRegisterMode ? `${BACKEND_URL}/register` : `${BACKEND_URL}/login`

    try {
      logger.info(`Dispatching ${isRegisterMode ? 'Registration' : 'Login'} request...`)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Authentication request rejected.')
      }

      if (isRegisterMode) {
        setIsRegisterMode(false)
        setAuthError('Account registered successfully! Please log in.')
      } else {
        const authData = data as AuthResponse
        localStorage.setItem('draft_token', authData.access_token)
        localStorage.setItem('draft_username', authData.username)
        setToken(authData.access_token)
        setCurrentUser(authData.username)
        setShowAuthModal(false)
        setAuthUsername('')
        setAuthPassword('')
        logger.info('Authentication successful for:', authData.username)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      logger.error('Auth error:', msg)
      setAuthError(msg)
    } finally {
      setIsAuthLoading(false)
    }
  }

  /**
   * Solicits an innovative interview question from the backend, including the JWT auth header.
   * Why: Enables the backend to check previous user questions in question_logs and prevent duplicates.
   */
  const handleFetchQuestion = async (): Promise<void> => {
    setIsLoadingQuestion(true)
    setSubmissionStatus('idle')
    setStatusMessage('')
    setAnswer('')

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      logger.info('Requesting interview question with topic:', topic, 'difficulty:', difficulty)
      const response = await fetch(`${BACKEND_URL}/generate_question`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ topic, difficulty }),
      })

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`)
      }

      const data: QuestionResponse = await response.json()
      setQuestion(data.question)
      logger.info('Question generated. ID:', data.question_id)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown network error'
      logger.error('Failed to generate question:', errMsg)
      setQuestion('Unable to connect to backend server. Make sure your Python server is running.')
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  /**
   * Persists candidate response to PostgreSQL linked to user_id.
   * Why: Guarantees candidate evaluation submissions are permanently logged in PostgreSQL.
   */
  const handleSubmitAnswer = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()

    const trimmedAnswer = answer.trim()
    if (!trimmedAnswer) {
      setSubmissionStatus('error')
      setStatusMessage('Please enter an answer before submitting.')
      return
    }

    setIsSubmitting(true)
    setSubmissionStatus('idle')
    setStatusMessage('')

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      logger.info('Submitting answer to PostgreSQL...')
      const response = await fetch(`${BACKEND_URL}/submit_answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question,
          answer: trimmedAnswer,
          topic,
          difficulty,
        }),
      })

      const data: SubmissionResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Server responded with status ${response.status}`)
      }

      setSubmissionStatus('success')
      setStatusMessage('Answer saved to PostgreSQL database!')
      setSubmissionDetails(data)
      logger.info('Submission confirmed. ID:', data.submission_id)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Submission failed'
      logger.error('Failed to persist answer:', errMsg)
      setSubmissionStatus('error')
      setStatusMessage(`Error saving response: ${errMsg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={styles.pageContainer}>
      {/* Top Navigation Bar */}
      <nav style={styles.navBar}>
        <div style={styles.logoBadge}>🏈 DATA SCIENCE DRAFT</div>

        <div style={styles.authStatusArea}>
          {currentUser ? (
            <div style={styles.userBadgeWrap}>
              <span style={styles.userBadge}>GM: {currentUser}</span>
              <button
                type="button"
                onClick={handleSignOut}
                style={styles.secondaryButton}
                aria-label="Sign Out"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(true)
                setAuthError('')
              }}
              style={styles.loginButton}
              aria-label="Sign In or Register"
            >
              🔐 Sign In / Register
            </button>
          )}
        </div>
      </nav>

      {/* Main Header */}
      <header style={styles.header}>
        <h1 style={styles.mainTitle}>
          THE LOCKER ROOM <span style={styles.accentText}>COMBINE</span>
        </h1>
        <p style={styles.subtitle}>
          Draft AI-engineered technical challenges and submit answers stored directly into PostgreSQL.
        </p>

        {/* Topic and Difficulty Selectors */}
        <div style={styles.controlsRow}>
          <div style={styles.selectGroup}>
            <label htmlFor="topic-select" style={styles.controlLabel}>TOPIC:</label>
            <select
              id="topic-select"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={styles.selectInput}
            >
              <option value="Machine Learning & AI">Machine Learning & AI</option>
              <option value="SQL & Data Engineering">SQL & Data Engineering</option>
              <option value="Deep Learning & LLMs">Deep Learning & LLMs</option>
              <option value="System Design & MLOps">System Design & MLOps</option>
              <option value="Statistics & Probability">Statistics & Probability</option>
            </select>
          </div>

          <div style={styles.selectGroup}>
            <label htmlFor="difficulty-select" style={styles.controlLabel}>DIFFICULTY:</label>
            <select
              id="difficulty-select"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              style={styles.selectInput}
            >
              <option value="Rookie (Easy)">Rookie (Easy)</option>
              <option value="Starter (Intermediate)">Starter (Intermediate)</option>
              <option value="All-Pro (Challenging)">All-Pro (Challenging)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleFetchQuestion}
            disabled={isLoadingQuestion}
            style={{
              ...styles.primaryButton,
              opacity: isLoadingQuestion ? 0.7 : 1,
              cursor: isLoadingQuestion ? 'not-allowed' : 'pointer',
            }}
            aria-label="Draft question"
          >
            {isLoadingQuestion ? '⏱️ Scouting Question...' : '🏈 Draft Next Question'}
          </button>
        </div>
      </header>

      {/* Interview Question & Answering Area */}
      <main style={styles.mainContent}>
        {question && (
          <section style={styles.glassCard} aria-labelledby="challenge-heading">
            <div style={styles.cardHeader}>
              <span style={styles.cardTag}>ON THE CLOCK • {difficulty.toUpperCase()}</span>
              <h2 id="challenge-heading" style={styles.sectionTitle}>
                {topic}
              </h2>
            </div>

            <p style={styles.questionText}>{question}</p>

            {/* Answer Input Box */}
            <form onSubmit={handleSubmitAnswer} style={styles.formContainer}>
              <div style={styles.inputHeader}>
                <label htmlFor="answer-input" style={styles.inputLabel}>
                  Your Technical Answer:
                </label>
                <span style={styles.charCounter}>{answer.length} characters</span>
              </div>

              <textarea
                id="answer-input"
                value={answer}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(e.target.value)}
                placeholder="Draft your detailed answer here... Include algorithmic tradeoffs, edge cases, and design choices."
                rows={6}
                disabled={isSubmitting}
                style={styles.textarea}
                aria-required="true"
              />

              <div style={styles.actionsRow}>
                <button
                  type="submit"
                  disabled={isSubmitting || !answer.trim()}
                  style={{
                    ...styles.submitButton,
                    opacity: isSubmitting || !answer.trim() ? 0.6 : 1,
                    cursor: isSubmitting || !answer.trim() ? 'not-allowed' : 'pointer',
                  }}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? '💾 Storing in PostgreSQL...' : '🚀 Submit Answer'}
                </button>
              </div>

              {/* Status Message Badges */}
              {submissionStatus === 'success' && (
                <div style={styles.successBanner} role="status">
                  <span style={styles.badgeIcon}>✅</span>
                  <div>
                    <strong>{statusMessage}</strong>
                    {submissionDetails && (
                      <span style={styles.metaNote}>
                        {' '}(GM: {submissionDetails.username || 'Guest'} • Record #{submissionDetails.submission_id})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {submissionStatus === 'error' && (
                <div style={styles.errorBanner} role="alert">
                  <span style={styles.badgeIcon}>⚠️</span>
                  <span>{statusMessage}</span>
                </div>
              )}
            </form>
          </section>
        )}
      </main>

      {/* Authentication Modal */}
      {showAuthModal && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true">
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {isRegisterMode ? 'Create GM Account' : 'Front Office Sign In'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                style={styles.closeButton}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} style={styles.formContainer}>
              <div style={styles.formField}>
                <label htmlFor="auth-username" style={styles.inputLabel}>
                  Username:
                </label>
                <input
                  id="auth-username"
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  required
                  placeholder="e.g. coach_mike"
                  style={styles.textInput}
                />
              </div>

              <div style={styles.formField}>
                <label htmlFor="auth-password" style={styles.inputLabel}>
                  Password:
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={styles.textInput}
                />
              </div>

              {authError && <div style={styles.modalError}>{authError}</div>}

              <button
                type="submit"
                disabled={isAuthLoading}
                style={styles.authSubmitButton}
              >
                {isAuthLoading
                  ? 'Processing...'
                  : isRegisterMode
                  ? 'Create Franchise'
                  : 'Sign In to Draft Board'}
              </button>

              <p style={styles.modalFooterText}>
                {isRegisterMode ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode)
                    setAuthError('')
                  }}
                  style={styles.linkButton}
                >
                  {isRegisterMode ? 'Sign In' : 'Register Here'}
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: '#05080f',
    color: '#f8fafc',
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    padding: '20px 20px 60px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  navBar: {
    maxWidth: '900px',
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    borderRadius: '14px',
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    marginBottom: '32px',
  },
  logoBadge: {
    fontWeight: 800,
    fontSize: '1rem',
    letterSpacing: '1px',
    color: '#fbbf24',
  },
  authStatusArea: {
    display: 'flex',
    alignItems: 'center',
  },
  userBadgeWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userBadge: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#60a5fa',
    background: 'rgba(59, 130, 246, 0.15)',
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  loginButton: {
    padding: '8px 16px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#f8fafc',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  secondaryButton: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#94a3b8',
    backgroundColor: 'transparent',
    border: '1px solid #334155',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  header: {
    maxWidth: '900px',
    width: '100%',
    textAlign: 'center',
    marginBottom: '36px',
  },
  mainTitle: {
    fontSize: '2.8rem',
    fontWeight: 800,
    letterSpacing: '-1px',
    margin: '0 0 12px 0',
    lineHeight: 1.1,
  },
  accentText: {
    color: '#3b82f6',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#94a3b8',
    marginBottom: '28px',
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    alignItems: 'flex-end',
  },
  selectGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '6px',
  },
  controlLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#94a3b8',
  },
  selectInput: {
    padding: '12px 16px',
    fontSize: '0.95rem',
    color: '#f8fafc',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '10px',
    outline: 'none',
  },
  primaryButton: {
    padding: '12px 28px',
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0f172a',
    backgroundColor: '#fbbf24',
    border: 'none',
    borderRadius: '10px',
    boxShadow: '0 10px 20px -5px rgba(251, 191, 36, 0.4)',
    transition: 'all 0.2s ease',
  },
  mainContent: {
    maxWidth: '900px',
    width: '100%',
  },
  glassCard: {
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    padding: '32px',
  },
  cardHeader: {
    marginBottom: '14px',
  },
  cardTag: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '2px',
    color: '#fbbf24',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '4px 0 0 0',
    color: '#f8fafc',
  },
  questionText: {
    fontSize: '1.15rem',
    lineHeight: 1.8,
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    padding: '20px',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    marginBottom: '24px',
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  inputHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#cbd5e1',
  },
  charCounter: {
    fontSize: '0.85rem',
    color: '#64748b',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '16px',
    fontSize: '1rem',
    color: '#f8fafc',
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    border: '1px solid #334155',
    borderRadius: '10px',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    outline: 'none',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '6px',
  },
  submitButton: {
    padding: '12px 26px',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '10px',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
    transition: 'all 0.2s ease',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    borderRadius: '10px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#34d399',
    marginTop: '12px',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    borderRadius: '10px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    marginTop: '12px',
  },
  badgeIcon: {
    fontSize: '1.2rem',
  },
  metaNote: {
    color: '#a7f3d0',
    fontSize: '0.85rem',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalCard: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#0f172a',
    borderRadius: '16px',
    border: '1px solid #334155',
    padding: '30px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#f8fafc',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '1.2rem',
    cursor: 'pointer',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '16px',
  },
  textInput: {
    padding: '12px',
    fontSize: '1rem',
    backgroundColor: '#020617',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f8fafc',
    outline: 'none',
  },
  authSubmitButton: {
    padding: '14px',
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0f172a',
    backgroundColor: '#fbbf24',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  modalError: {
    color: '#f87171',
    fontSize: '0.9rem',
    marginBottom: '12px',
  },
  modalFooterText: {
    textAlign: 'center',
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginTop: '16px',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    fontWeight: 600,
    padding: 0,
    textDecoration: 'underline',
  },
}

export default App
