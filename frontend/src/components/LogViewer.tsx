import { useEffect, useRef } from 'react'

interface LogViewerProps {
  containerName: string | null
  lines: string[]
  streaming: boolean
  error: string | null
}

export function LogViewer({ containerName, lines, streaming, error }: LogViewerProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

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

      <div className="log-viewer">
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
        <div ref={endRef} />
      </div>
    </>
  )
}
