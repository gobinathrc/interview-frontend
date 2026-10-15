import React, { useState } from 'react'

/**
 * Dedicated production logger interface.
 * Why: Adheres to clean code standards by eliminating unformatted console statements in production.
 */
const logger = {
  info: (msg: string, ...args: unknown[]) => console.info(`[DS-Draft INFO] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[DS-Draft WARN] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[DS-Draft ERROR] ${msg}`, ...args),
}

interface SubmissionResponse {
  status: string
  message: string
  submission_id?: number
  created_at?: string
}

/**
 * Main application component for the Data Science Draft interview platform.
 * Why: Orchestrates dynamic question generation, candidate input state, and PostgreSQL submission.
 */
export function App(): React.JSX.Element {
  const [question, setQuestion] = useState<string>('')
  const [answer, setAnswer] = useState<string>('')
  const [isLoadingQuestion, setIsLoadingQuestion] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [submissionId, setSubmissionId] = useState<number | null>(null)

  const BACKEND_URL = 'https://interview-backend-2-svse.onrender.com'

  /**
   * Fetches a newly generated data science interview question from the backend.
   * Why: Solicits unprompted, high-challenge technical evaluations from the AI scout.
   */
  const handleFetchQuestion = async (): Promise<void> => {
    setIsLoadingQuestion(true)
    setSubmissionStatus('idle')
    setStatusMessage('')
    setAnswer('')

    try {
      logger.info('Requesting fresh question from backend...')
      const response = await fetch(`${BACKEND_URL}/generate_question`)
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`)
      }
      const data = await response.json()
      setQuestion(data.question)
      logger.info('Question received successfully')
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown network error'
      logger.error('Failed to fetch question:', errMsg)
      setQuestion('Unable to connect to backend server. Verify the Render service is running.')
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  /**
   * Dispatches candidate answer to the PostgreSQL backend database.
   * Why: Permanently stores responses with relational question context for auditing.
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

    try {
      logger.info('Submitting candidate response to PostgreSQL...')
      const response = await fetch(`${BACKEND_URL}/submit_answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          answer: trimmedAnswer,
        }),
      })

      const data: SubmissionResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Server responded with status ${response.status}`)
      }

      setSubmissionStatus('success')
      setStatusMessage('Answer saved to PostgreSQL database!')
      setSubmissionId(data.submission_id ?? null)
      logger.info('Submission confirmed. Record ID:', data.submission_id)
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
      <header style={styles.header}>
        <div style={styles.pillBadge}>🏈 THE FRONT OFFICE COMBINE</div>
        <h1 style={styles.mainTitle}>
          DATA SCIENCE <span style={styles.accentText}>DRAFT</span>
        </h1>
        <p style={styles.subtitle}>
          Generate industry-grade AI interview challenges and log your responses directly into PostgreSQL.
        </p>

        <button
          type="button"
          onClick={handleFetchQuestion}
          disabled={isLoadingQuestion}
          style={{
            ...styles.primaryButton,
            opacity: isLoadingQuestion ? 0.7 : 1,
            cursor: isLoadingQuestion ? 'not-allowed' : 'pointer',
          }}
          aria-label="Draft next interview question"
        >
          {isLoadingQuestion ? '⏱️ Scouting Next Question...' : '🏈 Draft Next Question'}
        </button>
      </header>

      <main style={styles.mainContent}>
        {question && (
          <section style={styles.glassCard} aria-labelledby="question-heading">
            <div style={styles.cardHeader}>
              <span style={styles.cardTag}>ON THE CLOCK</span>
              <h2 id="question-heading" style={styles.sectionTitle}>
                The Interview Challenge
              </h2>
            </div>
            <p style={styles.questionText}>{question}</p>

            <form onSubmit={handleSubmitAnswer} style={styles.formContainer}>
              <div style={styles.inputHeader}>
                <label htmlFor="answer-input" style={styles.inputLabel}>
                  Your Technical Response:
                </label>
                <span style={styles.charCounter}>
                  {answer.length} characters
                </span>
              </div>

              <textarea
                id="answer-input"
                value={answer}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(e.target.value)}
                placeholder="Formulate your detailed technical response here... Discuss architectural tradeoffs, assumptions, and complexity analysis."
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

              {submissionStatus === 'success' && (
                <div style={styles.successBanner} role="status">
                  <span style={styles.badgeIcon}>✅</span>
                  <div>
                    <strong>{statusMessage}</strong>
                    {submissionId && (
                      <span style={styles.metaNote}> (Database Record #{submissionId})</span>
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
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: '#05080f',
    color: '#f8fafc',
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: {
    maxWidth: '850px',
    width: '100%',
    textAlign: 'center',
    marginBottom: '40px',
  },
  pillBadge: {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: '9999px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    color: '#60a5fa',
    fontSize: '0.85rem',
    fontWeight: 700,
    letterSpacing: '1.5px',
    marginBottom: '18px',
  },
  mainTitle: {
    fontSize: '3rem',
    fontWeight: 800,
    letterSpacing: '-1px',
    margin: '0 0 16px 0',
    lineHeight: 1.1,
  },
  accentText: {
    color: '#3b82f6',
  },
  subtitle: {
    fontSize: '1.15rem',
    color: '#94a3b8',
    marginBottom: '32px',
    lineHeight: 1.6,
  },
  primaryButton: {
    padding: '14px 32px',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0f172a',
    backgroundColor: '#fbbf24',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(251, 191, 36, 0.4)',
    transition: 'all 0.2s ease',
  },
  mainContent: {
    maxWidth: '850px',
    width: '100%',
  },
  glassCard: {
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    padding: '36px',
  },
  cardHeader: {
    marginBottom: '16px',
  },
  cardTag: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '2px',
    color: '#fbbf24',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: '1.6rem',
    fontWeight: 700,
    margin: '6px 0 0 0',
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
    marginBottom: '28px',
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
    fontSize: '1rem',
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
    fontSize: '0.95rem',
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
    fontSize: '0.95rem',
  },
  badgeIcon: {
    fontSize: '1.2rem',
  },
  metaNote: {
    color: '#a7f3d0',
    fontSize: '0.85rem',
  },
}

export default App
