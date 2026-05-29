import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { getProblem, submitCode } from '../lib/api'
import { getProblemTags, addTag, removeTag, getAllUniqueTags } from '../lib/tags'
import type { ProblemDetail as ProblemDetailType, SubmitResult } from '../types'
import CodeEditor from '../components/CodeEditor'
import ResultPanel from '../components/ResultPanel'
import SolutionEditor from '../components/SolutionEditor'

const COMMON_TAGS = [
  '数组', '字符串', '哈希表', '动态规划', '贪心', '排序',
  '双指针', '递归', 'DFS', 'BFS', '栈', '队列',
  '链表', '二叉树', '图', '滑动窗口', '前缀和', '二分查找', '回溯', '位运算',
]

export default function ProblemDetail() {
  const { id: encodedId } = useParams<{ id: string }>()
  const id = decodeURIComponent(encodedId || '')
  const [problem, setProblem] = useState<ProblemDetailType | null>(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    getProblem(id)
      .then((p) => {
        setProblem(p)
        setCode(p.starter_code || '')
        setResult(null)
        setError('')
        setTags(getProblemTags(id))
        setAllTags(getAllUniqueTags())
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [id])

  const handleSubmit = useCallback(async () => {
    if (!id || !code.trim()) return
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const res = await submitCode(id, code)
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setRunning(false)
    }
  }, [id, code])

  const handleAddTag = (t: string) => {
    const tag = t.trim()
    if (tag) {
      addTag(id, tag)
      setTags(getProblemTags(id))
      setAllTags(getAllUniqueTags())
      setNewTag('')
      setShowTagInput(false)
    }
  }

  const handleRemoveTag = (t: string) => {
    removeTag(id, t)
    setTags(getProblemTags(id))
    setAllTags(getAllUniqueTags())
  }

  const unusedTags = allTags.filter((t) => !tags.includes(t))

  const diffConfig =
    problem?.difficulty === 'easy'
      ? { label: '简单', color: 'var(--green)', bg: 'rgba(0,175,155,0.12)' }
      : problem?.difficulty === 'medium'
        ? { label: '中等', color: 'var(--yellow)', bg: 'rgba(255,184,0,0.12)' }
        : { label: '困难', color: 'var(--red)', bg: 'rgba(255,45,85,0.12)' }

  if (error && !problem) {
    return (
      <div className="flex justify-center items-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center p-8 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <p style={{ color: 'var(--red)', fontSize: '0.95rem' }}>{error}</p>
          <a href="/" className="text-sm mt-4 inline-block" style={{ color: 'var(--blue)' }}>← 返回题库</a>
        </div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="skeleton h-8 w-32 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* ═══ Top Navigation Bar ═══ */}
      <header
        className="flex items-center gap-3 px-4 py-2 shrink-0"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}
      >
        {/* Back */}
        <a
          href="/"
          className="flex items-center no-underline transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </a>

        {/* Title */}
        <h1 className="text-[15px] font-semibold truncate" style={{ color: '#fff' }}>
          {problem.title}
        </h1>

        {/* Difficulty badge */}
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: diffConfig.bg, color: diffConfig.color }}
        >
          {diffConfig.label}
        </span>

        {/* Submit button — right aligned */}
        <button
          onClick={handleSubmit}
          disabled={running}
          className="lc-btn lc-btn-primary ml-auto text-sm"
        >
          {running ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              判题中...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              提交代码
            </>
          )}
        </button>
      </header>

      {/* ═══ Main Content: Split Panel ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Problem Description (45%) ── */}
        <div
          className="w-[45%] overflow-y-auto shrink-0"
          style={{ borderRight: '1px solid var(--border-primary)', background: 'var(--bg-primary)' }}
        >
          <div className="p-8">
            {/* Tags */}
            <div className="flex flex-wrap items-center gap-1.5 mb-6">
              {tags.map((t) => (
                <span
                  key={t}
                  className="lc-tag lc-tag-active text-xs"
                >
                  {t}
                  <button
                    onClick={() => handleRemoveTag(t)}
                    className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}

              {showTagInput ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    ref={tagInputRef}
                    type="text"
                    placeholder="输入标签..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTag(newTag)
                      if (e.key === 'Escape') { setShowTagInput(false); setNewTag('') }
                    }}
                    className="w-20 text-xs px-2 py-1 rounded-full outline-none"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--blue)',
                      color: 'var(--text-primary)',
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => { setShowTagInput(false); setNewTag('') }}
                    className="text-xs transition-colors"
                    style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm transition-colors"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px dashed var(--border-primary)',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              )}

              {/* Tag suggestions */}
              {showTagInput && (
                <div className="flex flex-wrap gap-1 w-full mt-1">
                  {COMMON_TAGS
                    .filter((t) => !tags.includes(t) && (!newTag || t.includes(newTag)))
                    .slice(0, 10)
                    .map((t) => (
                      <button
                        key={t}
                        onClick={() => handleAddTag(t)}
                        className="lc-tag lc-tag-default text-[11px]"
                      >
                        + {t}
                      </button>
                    ))}
                  {unusedTags
                    .filter((t) => !COMMON_TAGS.includes(t) && (!newTag || t.includes(newTag)))
                    .slice(0, 6)
                    .map((t) => (
                      <button
                        key={t}
                        onClick={() => handleAddTag(t)}
                        className="lc-tag lc-tag-default text-[11px]"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        + {t}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Markdown description */}
            <div className="prose max-w-none">
              <ReactMarkdown>{problem.description}</ReactMarkdown>
            </div>

            {/* Solution editor */}
            <div className="mt-6">
              <SolutionEditor problemId={id} />
            </div>
          </div>
        </div>

        {/* ── Right: Code Editor + Results (55%) ── */}
        <div className="w-[55%] flex flex-col overflow-hidden">
          {/* Editor */}
          <div className="flex-1 min-h-0">
            <CodeEditor value={code} onChange={(v) => setCode(v || '')} />
          </div>

          {/* Results panel */}
          <div
            className="shrink-0 max-h-[40%] overflow-y-auto p-3"
            style={{ borderTop: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}
          >
            {error && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{
                  background: 'var(--red-bg)',
                  border: '1px solid var(--red-border)',
                  color: 'var(--red)',
                }}
              >
                {error}
              </div>
            )}
            {result && <ResultPanel result={result} />}
            {!result && !error && (
              <div className="text-center text-sm py-6" style={{ color: 'var(--text-tertiary)' }}>
                点击「提交代码」执行判题
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
