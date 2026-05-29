import { useState, useEffect, useMemo } from 'react'
import { getDifficultyStats, getSubmissionHeatmap, type DifficultyStats, type HeatmapEntry } from '../lib/api'

const COLORS = {
  easy: '#00af9b',
  medium: '#ffb800',
  hard: '#ff2d55',
  solved: '#4a9eff',
  unsolved: '#333',
}

export default function Home() {
  const [stats, setStats] = useState<DifficultyStats | null>(null)
  const [heatmapData, setHeatmapData] = useState<HeatmapEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDifficultyStats(), getSubmissionHeatmap()])
      .then(([s, h]) => { setStats(s); setHeatmapData(h) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Heatmap grid logic
  const heatmap = useMemo(() => {
    if (heatmapData.length === 0) return { weeks: [], monthLabels: [], maxCount: 0 }
    const map = new Map<string, number>()
    let max = 0
    for (const d of heatmapData) { map.set(d.date, d.count); if (d.count > max) max = d.count }

    const firstDate = new Date(heatmapData[0].date + 'T00:00:00')
    const start = new Date(firstDate)
    start.setDate(start.getDate() - start.getDay())

    const weeks: { date: string; count: number }[][] = []
    const monthLabels: { col: number; label: string }[] = []
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    let current = new Date(start)
    let lastMonth = -1

    while (current <= new Date()) {
      const ds = current.toISOString().split('T')[0]
      const month = current.getMonth()
      if (month !== lastMonth) { monthLabels.push({ col: weeks.length, label: MONTHS[month] }); lastMonth = month }

      const dow = current.getDay()
      if (dow === 0 || weeks.length === 0) weeks.push([])
      const col = weeks.length - 1
      while (weeks[col].length < dow) weeks[col].push({ date: '', count: -1 })
      weeks[col].push({ date: ds, count: map.get(ds) || 0 })
      current.setDate(current.getDate() + 1)
    }
    return { weeks, monthLabels, maxCount: Math.max(1, max) }
  }, [heatmapData])

  const getHeatColor = (count: number, max: number): string => {
    if (count < 0) return 'transparent'
    if (count === 0) return '#1e1e1e'
    const r = count / max
    if (r <= 0.25) return '#0e4429'
    if (r <= 0.5) return '#006d32'
    if (r <= 0.75) return '#26a641'
    return '#39d353'
  }

  // Ring chart data
  const ringData = useMemo(() => {
    if (!stats) return null
    const diff = [
      { label: '简单', value: stats.easy.solved, total: stats.easy.total, color: COLORS.easy },
      { label: '中等', value: stats.medium.solved, total: stats.medium.total, color: COLORS.medium },
      { label: '困难', value: stats.hard.solved, total: stats.hard.total, color: COLORS.hard },
    ]
    const overall = stats.overall
    const totalSolved = overall.solved
    const totalAll = overall.total
    const pct = totalAll > 0 ? Math.round((totalSolved / totalAll) * 100) : 0
    return { diff, totalSolved, totalAll, pct }
  }, [stats])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-4">
        <div className="skeleton h-[180px] rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-[200px] rounded-lg" />
          <div className="skeleton h-[200px] rounded-lg" />
        </div>
      </div>
    )
  }

  const totalSubs = heatmapData.reduce((s, d) => s + d.count, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#fff' }}>个人主页</h1>

      {/* Heatmap */}
      <div
        className="rounded-lg p-5 mb-6"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold" style={{ color: '#fff' }}>
            {totalSubs} submissions in the last year
          </span>
          <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            Less
            {[0, 1, 2, 3].map((lvl) => (
              <span key={lvl} className="w-3 h-3 rounded-sm"
                style={{ background: getHeatColor(lvl === 0 ? 0 : Math.ceil(((lvl + 1) / 4) * heatmap.maxCount), heatmap.maxCount) }}
              />
            ))}
            More
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div className="flex mb-1" style={{ paddingLeft: 28 }}>
            {heatmap.monthLabels.map((m, i) => {
              const gap = i < heatmap.monthLabels.length - 1
                ? (heatmap.monthLabels[i + 1].col - m.col) * 15 - 18
                : 0
              return (
                <span key={i} className="text-[9px]" style={{ marginRight: Math.max(0, gap), color: 'var(--text-tertiary)' }}>
                  {m.label}
                </span>
              )
            })}
          </div>
          <div className="flex" style={{ gap: 3 }}>
            <div className="flex flex-col shrink-0" style={{ gap: 3, width: 24 }}>
              {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((l, i) => (
                <span key={i} className="text-[9px] flex items-center justify-end pr-1"
                  style={{ height: 13, color: 'var(--text-tertiary)' }}>{l}</span>
              ))}
            </div>
            {heatmap.weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: 3 }}>
                {Array.from({ length: 7 }).map((_, di) => {
                  const e = week[di]
                  const c = e?.count ?? -1
                  return (
                    <div key={di} className="rounded-sm" style={{ width: 13, height: 13, background: getHeatColor(c, heatmap.maxCount) }}
                      title={e?.date ? `${e.date}: ${c} submissions` : ''} />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row: ring chart + progress */}
      {ringData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Donut chart */}
          <div
            className="rounded-lg p-5 flex flex-col items-center"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
            <h3 className="text-sm font-semibold mb-4 self-start" style={{ color: '#fff' }}>完成进度</h3>
            <svg width="180" height="180" viewBox="0 0 180 180">
              {/* Background circle */}
              <circle cx="90" cy="90" r="70" fill="none" stroke="#333" strokeWidth="16" />
              {/* Solved arc */}
              {ringData.pct > 0 && (
                <circle
                  cx="90" cy="90" r="70" fill="none" stroke={COLORS.solved} strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${ringData.pct * 4.398} 439.8`}
                  transform="rotate(-90 90 90)"
                  style={{ transition: 'stroke-dasharray 1s ease' }}
                />
              )}
              {/* Center text */}
              <text x="90" y="82" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="bold">
                {ringData.pct}%
              </text>
              <text x="90" y="105" textAnchor="middle" fill="var(--text-tertiary)" fontSize="12">
                {ringData.totalSolved}/{ringData.totalAll} solved
              </text>
            </svg>
            {/* Legend */}
            <div className="flex gap-4 mt-3">
              {ringData.diff.map((d) => (
                <div key={d.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  {d.label} {d.value}/{d.total}
                </div>
              ))}
            </div>
          </div>

          {/* Difficulty breakdown */}
          <div
            className="rounded-lg p-5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#fff' }}>难度分布</h3>
            <div className="space-y-4">
              {ringData.diff.map((d) => {
                const pct = d.total > 0 ? Math.round((d.value / d.total) * 100) : 0
                return (
                  <div key={d.label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-medium" style={{ color: d.color }}>{d.label}</span>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {d.value}/{d.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: d.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Total bar */}
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <div className="flex justify-between mb-1.5">
                <span className="text-sm font-medium" style={{ color: '#fff' }}>总计</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {ringData.totalSolved}/{ringData.totalAll} ({ringData.pct}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${ringData.pct}%`, background: COLORS.solved }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
