import { useState, useEffect } from 'react'
import { getSubmissionTrend, type TrendEntry } from '../lib/api'

export default function SubmissionChart() {
  const [data, setData] = useState<TrendEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubmissionTrend()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="skeleton h-[160px] rounded-lg" />
  if (data.length === 0) return null

  const maxSubs = Math.max(1, ...data.map((d) => d.total_submissions))
  const chartHeight = 100

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
    >
      <h3 className="text-sm font-semibold mb-3" style={{ color: '#fff' }}>提交趋势</h3>

      {/* Bar chart */}
      <div className="flex items-end gap-[2px]" style={{ height: chartHeight }}>
        {data.map((d) => {
          const barH = Math.max(2, (d.total_submissions / maxSubs) * chartHeight)
          return (
            <div
              key={d.week}
              className="flex-1 rounded-t-sm transition-all hover:opacity-80"
              style={{
                height: barH,
                background: d.pass_rate >= 50
                  ? 'var(--green)'
                  : d.pass_rate > 0
                    ? 'var(--yellow)'
                    : 'var(--border-primary)',
                opacity: d.total_submissions > 0 ? 1 : 0.3,
              }}
              title={`${d.week}: ${d.total_submissions} subs, ${d.pass_rate}% pass`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          {data[0]?.week}
        </span>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          <span>▮ 提交</span>
          <span style={{ color: 'var(--green)' }}>≥50%</span>
          <span style={{ color: 'var(--yellow)' }}>&lt;50%</span>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          {data[data.length - 1]?.week}
        </span>
      </div>
    </div>
  )
}
