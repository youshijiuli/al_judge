import type { SubmitResult } from '../types'

interface Props {
  result: SubmitResult
}

const statusConfig: Record<string, { label: string; bg: string; border: string; text: string; icon: string }> = {
  'Accepted': {
    label: 'Accepted',
    bg: 'rgba(0,175,155,0.08)',
    border: 'rgba(0,175,155,0.3)',
    text: 'var(--green)',
    icon: 'AC',
  },
  'Wrong Answer': {
    label: 'Wrong Answer',
    bg: 'rgba(255,45,85,0.08)',
    border: 'rgba(255,45,85,0.3)',
    text: 'var(--red)',
    icon: 'WA',
  },
  'Time Limit Exceeded': {
    label: 'Time Limit Exceeded',
    bg: 'rgba(255,184,0,0.08)',
    border: 'rgba(255,184,0,0.3)',
    text: 'var(--yellow)',
    icon: 'TLE',
  },
  'Runtime Error': {
    label: 'Runtime Error',
    bg: 'rgba(179,116,255,0.08)',
    border: 'rgba(179,116,255,0.3)',
    text: 'var(--purple)',
    icon: 'RE',
  },
  'Syntax Error': {
    label: 'Syntax Error',
    bg: 'rgba(255,140,66,0.08)',
    border: 'rgba(255,140,66,0.3)',
    text: 'var(--orange)',
    icon: 'SE',
  },
}

export default function ResultPanel({ result }: Props) {
  const c = statusConfig[result.status] || statusConfig['Wrong Answer']

  return (
    <div
      className="rounded-lg p-4 text-sm animate-[fadeIn_0.2s_ease]"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-base font-extrabold tracking-tight px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          {c.icon}
        </span>
        <span className="font-semibold text-base">{c.label}</span>
        <span className="ml-auto" style={{ color: 'var(--text-secondary)' }}>
          {result.passed}/{result.total} 通过 · {result.max_runtime_ms.toFixed(2)} ms
        </span>
      </div>

      {/* Error message */}
      {result.error && (
        <div
          className="mb-3 p-3 rounded text-sm font-mono whitespace-pre-wrap"
          style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--red)' }}
        >
          {result.error}
        </div>
      )}

      {/* Case details */}
      <div className="space-y-0.5">
        {result.cases.map((c) => (
          <details key={c.id} className="text-sm group">
            <summary
              className="cursor-pointer flex items-center gap-2 py-1.5 px-1 rounded hover:bg-white/5 transition-colors select-none"
            >
              <span
                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: c.passed ? 'var(--green)' : 'var(--red)' }}
              >
                {c.passed ? '✓' : '✗'}
              </span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Case #{c.id}
              </span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                {c.runtime_ms.toFixed(2)} ms
              </span>
              {c.passed ? (
                <span className="ml-auto" style={{ color: 'var(--green)', fontSize: '0.75rem' }}>通过</span>
              ) : (
                <span className="ml-auto" style={{ color: 'var(--red)', fontSize: '0.75rem' }}>失败</span>
              )}
            </summary>
            <div className="ml-6 mt-1 space-y-0.5 text-xs py-1">
              {c.input && (
                <div><span style={{ color: 'var(--text-tertiary)' }}>输入: </span>
                  <code className="rounded px-1" style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)' }}>{c.input}</code>
                </div>
              )}
              {c.expected && (
                <div><span style={{ color: 'var(--text-tertiary)' }}>期望: </span>
                  <code className="rounded px-1" style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--green)' }}>{c.expected}</code>
                </div>
              )}
              {c.actual && (
                <div><span style={{ color: 'var(--text-tertiary)' }}>实际: </span>
                  <code className="rounded px-1" style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--red)' }}>{c.actual}</code>
                </div>
              )}
              {c.error && <div style={{ color: 'var(--red)' }}>{c.error}</div>}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
