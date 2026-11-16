import { useCallback, useEffect, useRef, useState } from 'react'

interface LogViewerProps {
  containerName: string | null
  lines: string[]
  streaming: boolean
  error: string | null
}

const STICK_THRESHOLD_PX = 48

export function LogViewer({ containerName, lines, streaming, error }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [stick, setStick] = useState(true)

  const scrollToLatest = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setStick(true)
  }, [])

  // Follow the tail only while the user is already at the bottom, so scrolling
  // back through history is not yanked away by incoming lines.
  useEffect(() => {
    if (!stick) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, stick])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX)
  }

  if (!containerName) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon">&gt;_</span>
        <span>Select a container<br />from the Containers tab</span>
      </div>
    )
  }

  return (
    <>
      <div className="log-header">
        <span className="log-header__name">{containerName}</span>
        <span className={`log-header__badge${streaming ? ' log-header__badge--live' : ''}`}>
          {streaming ? 'STREAMING' : 'IDLE'}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="log-body">
        <div className="log-viewer" ref={scrollRef} onScroll={onScroll}>
          {lines.length === 0 && !error && (
            <div className="empty-state" style={{ height: 120 }}>
              <span>Waiting for log output…</span>
            </div>
          )}
          {lines.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))}
        </div>
        {!stick && (
          <button className="log-jump" onClick={scrollToLatest} type="button">
            ↓ Latest
          </button>
        )}
      </div>
    </>
  )
}
