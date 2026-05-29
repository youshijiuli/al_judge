import { useState, useEffect, useMemo } from 'react'
import { getSubmissionHeatmap, type HeatmapEntry } from '../lib/api'

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Heatmap() {
  const [data, setData] = useState<HeatmapEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubmissionHeatmap()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const { grid, monthLabels, maxCount } = useMemo(() => {
    if (data.length === 0) return { grid: [], monthLabels: [], maxCount: 0 }

    // Build date → count map
    const map = new Map<string, number>()
    let max = 0
    for (const d of data) {
      map.set(d.date, d.count)
      if (d.count > max) max = d.count
    }

    // Determine the start date (first Sunday before or at data[0])
    const firstDate = new Date(data[0].date + 'T00:00:00')
    const startDay = firstDate.getDay() // 0=Sun
    const start = new Date(firstDate)
    start.setDate(start.getDate() - startDay) // Go back to Sunday

    // Build 7-row × N-column grid
    const weeks: { date: string; count: number }[][] = []
    const months: { col: number; label: string }[] = []
    let current = new Date(start)
    let col = 0
    let lastMonth = -1

    while (current <= new Date()) {
      const dateStr = current.toISOString().split('T')[0]
      const month = current.getMonth()

      if (month !== lastMonth) {
        months.push({ col, label: MONTH_LABELS[month] })
        lastMonth = month
      }

      const dayOfWeek = current.getDay()
      if (dayOfWeek === 0 || weeks.length === 0) {
        weeks.push([])
        col = weeks.length - 1
      }

      while (weeks[col].length < dayOfWeek) {
        weeks[col].push({ date: '', count: -1 }) // padding
      }
      weeks[col].push({ date: dateStr, count: map.get(dateStr) || 0 })

      current.setDate(current.getDate() + 1)
    }

    return { grid: weeks, monthLabels: months, maxCount: max }
  }, [data])

  if (loading) return <div className="skeleton h-[140px] rounded-lg" />

  const totalSubs = data.reduce((s, d) => s + d.count, 0)

  const getColor = (count: number): string => {
    if (count < 0) return 'transparent'
    if (count === 0) return '#1e1e1e'
    if (maxCount === 0) return '#1e1e1e'
    const ratio = count / Math.max(1, maxCount)
    if (ratio <= 0.25) return '#0e4429'
    if (ratio <= 0.5) return '#006d32'
    if (ratio <= 0.75) return '#26a641'
    return '#39d353'
  }

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color: '#fff' }}>
          {totalSubs} submissions in the last year
        </span>
        <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          Less
          {[0, 1, 2, 3].map((lvl) => (
            <span
              key={lvl}
              className="w-3 h-3 rounded-sm"
              style={{ background: getColor(lvl === 0 ? 0 : Math.ceil(((lvl + 1) / 4) * Math.max(1, maxCount))) }}
            />
          ))}
          More
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {/* Month labels */}
        <div className="flex mb-1" style={{ paddingLeft: 28 }}>
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="text-[9px]"
              style={{
                position: 'relative',
                left: m.col * 15,
                marginRight: i < monthLabels.length - 1
                  ? (monthLabels[i + 1].col - m.col) * 15 - 20
                  : 0,
                color: 'var(--text-tertiary)',
              }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="flex" style={{ gap: 3 }}>
          {/* Day labels */}
          <div className="flex flex-col shrink-0" style={{ gap: 3, width: 24 }}>
            {DAY_LABELS.map((label, i) => (
              <span
                key={i}
                className="text-[9px] flex items-center justify-end pr-1"
                style={{ height: 13, color: 'var(--text-tertiary)' }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Week columns */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: 3 }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const entry = week[di]
                const count = entry?.count ?? -1
                return (
                  <div
                    key={di}
                    className="rounded-sm transition-all"
                    style={{
                      width: 13,
                      height: 13,
                      background: getColor(count),
                    }}
                    title={entry?.date ? `${entry.date}: ${count} submissions` : ''}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
