import { useState, useEffect } from 'react'
import { getDifficultyStats, type DifficultyStats } from '../lib/api'

export default function StatsPanel() {
  const [stats, setStats] = useState<DifficultyStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDifficultyStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="skeleton h-[160px] rounded-lg" />
  if (!stats || stats.overall.total === 0) return null

  const colors: Record<string, string> = {
    easy: 'var(--green)',
    medium: 'var(--yellow)',
    hard: 'var(--red)',
  }
  const labels: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#fff' }}>难度统计</h3>

      {/* Progress bars */}
      <div className="space-y-3">
        {(['easy', 'medium', 'hard'] as const).map((diff) => {
          const s = stats[diff]
          const pct = s.total > 0 ? Math.round((s.solved / s.total) * 100) : 0
          return (
            <div key={diff}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: colors[diff] }}>
                  {labels[diff]}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {s.solved}/{s.total} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: colors[diff],
                    opacity: pct > 0 ? 1 : 0,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Overall */}
      <div
        className="mt-4 pt-3 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border-primary)' }}
      >
        <span className="text-xs font-semibold" style={{ color: '#fff' }}>
          总进度
        </span>
        <span className="text-sm font-bold" style={{ color: 'var(--blue)' }}>
          {stats.overall.solved}/{stats.overall.total}
          <span className="text-xs ml-1 font-normal" style={{ color: 'var(--text-tertiary)' }}>
            ({Math.round((stats.overall.solved / stats.overall.total) * 100)}%)
          </span>
        </span>
      </div>
    </div>
  )
}
