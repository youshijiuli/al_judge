import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { listProblems } from '../lib/api'
import { getTags, getAllUniqueTags } from '../lib/tags'
import type { ProblemSummary } from '../types'
import StatusBadge from '../components/StatusBadge'

const PAGE_SIZE = 20

const DIFF_OPTIONS = [
  { value: '', label: '全部难度' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]

const MODE_OPTIONS = [
  { value: '', label: '全部模式' },
  { value: 'core_code', label: '核心代码' },
  { value: 'stdio', label: '标准 I/O' },
]

export default function ProblemList() {
  const [problems, setProblems] = useState<ProblemSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [modeFilter, setModeFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [page, setPage] = useState(1)
  const [tags, setTags] = useState<Record<string, string[]>>({})

  useEffect(() => {
    listProblems()
      .then((data) => {
        setProblems(data)
        setTags(getTags())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const allTags = useMemo(() => getAllUniqueTags(), [])

  const toggleTag = (tag: string) =>
    setActiveTags((prev) => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })

  const filtered = useMemo(() => {
    let arr = problems
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      arr = arr.filter((p) => p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    }
    if (activeTags.size > 0) {
      arr = arr.filter((p) => {
        const ptags = tags[p.id] || []
        return Array.from(activeTags).every((t) => ptags.includes(t))
      })
    }
    if (modeFilter) arr = arr.filter((p) => p.mode === modeFilter)
    if (difficultyFilter) arr = arr.filter((p) => p.difficulty === difficultyFilter)
    return arr
  }, [problems, search, activeTags, modeFilter, difficultyFilter, tags])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value)
    setPage(1)
  }

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-[68px] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#fff' }}>题库</h1>
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {filtered.length} / {problems.length} 题
          </span>
          <a
            href="/admin"
            className="text-xs no-underline ml-auto px-2.5 py-1 rounded-md border transition-colors"
            style={{
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-primary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            管理
          </a>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="搜索题目名称..."
            value={search}
            onChange={(e) => handleFilterChange(setSearch, e.target.value)}
            className="lc-input w-56"
          />
          <select
            value={difficultyFilter}
            onChange={(e) => handleFilterChange(setDifficultyFilter, e.target.value)}
            className="lc-select"
          >
            {DIFF_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={modeFilter}
            onChange={(e) => handleFilterChange(setModeFilter, e.target.value)}
            className="lc-select"
          >
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {(search || modeFilter || difficultyFilter || activeTags.size > 0) && (
            <button
              onClick={() => {
                setSearch('')
                setModeFilter('')
                setDifficultyFilter('')
                setActiveTags(new Set())
                setPage(1)
              }}
              className="lc-btn lc-btn-ghost text-xs"
            >
              清除筛选
            </button>
          )}
        </div>

        {/* Tag chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-6">
            <span className="text-xs mr-1" style={{ color: 'var(--text-tertiary)' }}>
              标签:
            </span>
            {allTags.map((t) => {
              const active = activeTags.has(t)
              return (
                <button
                  key={t}
                  onClick={() => {
                    toggleTag(t)
                    setPage(1)
                  }}
                  className={`lc-tag ${active ? 'lc-tag-active' : 'lc-tag-default'}`}
                >
                  {t}
                </button>
              )
            })}
            {activeTags.size > 0 && (
              <button
                onClick={() => { setActiveTags(new Set()); setPage(1) }}
                className="text-[11px] ml-1 transition-colors"
                style={{ color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                清除标签
              </button>
            )}
          </div>
        )}

        {/* Table header */}
        <div
          className="flex items-center px-5 py-2.5 rounded-t-lg text-xs font-semibold uppercase tracking-wider"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-primary)' }}
        >
          <span className="w-16">状态</span>
          <span className="flex-1">题目</span>
          <span className="w-20 text-center">难度</span>
          <span className="w-24 text-center">模式</span>
          <span className="w-40">标签</span>
        </div>

        {/* Problem list */}
        <div
          className="rounded-b-lg overflow-hidden"
          style={{ border: '1px solid var(--border-primary)', borderTop: 'none' }}
        >
          {paged.map((p, idx) => {
            const ptags = tags[p.id] || []
            const isLast = idx === paged.length - 1
            return (
              <Link
                key={p.id}
                to={`/problem/${encodeURIComponent(p.id)}`}
                className="flex items-center px-5 py-3 no-underline transition-colors"
                style={{
                  background: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                  borderBottom: isLast ? 'none' : '1px solid var(--border-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)'
                }}
              >
                {/* Status */}
                <span className="w-16 shrink-0">
                  <StatusBadge status={p.status} />
                </span>

                {/* Title + ID */}
                <div className="flex-1 min-w-0 pr-3">
                  <div className="font-medium text-[15px] truncate" style={{ color: '#fff' }}>
                    {p.title}
                  </div>
                </div>

                {/* Difficulty */}
                <span
                  className="w-20 text-center text-xs font-semibold shrink-0"
                  style={{
                    color:
                      p.difficulty === 'easy'
                        ? 'var(--green)'
                        : p.difficulty === 'medium'
                          ? 'var(--yellow)'
                          : 'var(--red)',
                  }}
                >
                  {p.difficulty === 'easy' ? '简单' : p.difficulty === 'medium' ? '中等' : '困难'}
                </span>

                {/* Mode */}
                <span className="w-24 text-center text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                  {p.mode === 'core_code' ? '核心代码' : '标准 I/O'}
                </span>

                {/* Tags */}
                <div className="w-40 flex flex-wrap gap-1 shrink-0">
                  {ptags.slice(0, 3).map((t) => (
                    <button
                      key={t}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        toggleTag(t)
                        setPage(1)
                      }}
                      className={`lc-tag ${activeTags.has(t) ? 'lc-tag-active' : 'lc-tag-default'} text-[11px]`}
                    >
                      {t}
                    </button>
                  ))}
                  {ptags.length > 3 && (
                    <span className="text-[11px] px-1" style={{ color: 'var(--text-tertiary)' }}>
                      +{ptags.length - 3}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20" style={{ color: 'var(--text-tertiary)' }}>
            没有匹配的题目，试试调整筛选条件
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="lc-btn lc-btn-ghost text-sm"
            >
              ‹ 上一页
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let num: number
              if (totalPages <= 7) {
                num = i + 1
              } else if (page <= 4) {
                num = i + 1
              } else if (page >= totalPages - 3) {
                num = totalPages - 6 + i
              } else {
                num = page - 3 + i
              }
              return (
                <button
                  key={num}
                  onClick={() => setPage(num)}
                  className="w-8 h-8 text-sm rounded-md transition-colors flex items-center justify-center"
                  style={{
                    background: num === page ? 'var(--blue)' : 'transparent',
                    color: num === page ? '#fff' : 'var(--text-secondary)',
                    border: num === page ? 'none' : '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (num !== page) e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (num !== page) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {num}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="lc-btn lc-btn-ghost text-sm"
            >
              下一页 ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
