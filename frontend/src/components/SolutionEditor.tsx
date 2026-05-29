import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

interface Props {
  problemId: string
}

const STORAGE_KEY_PREFIX = 'faljudge_solutions_'

export default function SolutionEditor({ problemId }: Props) {
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + problemId)
    setContent(saved || '')
  }, [problemId])

  const save = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + problemId, content)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [content, problemId])

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid var(--border-primary)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          📝 题解
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setPreview(!preview)}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{
            background: preview ? 'var(--blue-bg)' : 'transparent',
            color: preview ? 'var(--blue)' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {preview ? '编辑' : '预览'}
        </button>
        <button
          onClick={save}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{
            background: 'var(--green-bg)',
            color: saved ? 'var(--green)' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {saved ? '✓ 已保存' : '保存'}
        </button>
      </div>

      {/* Content */}
      <div className="p-3" style={{ minHeight: 120 }}>
        {preview ? (
          <div className="prose max-w-none text-sm" style={{ color: 'var(--text-primary)' }}>
            <ReactMarkdown>{content || '*暂无题解*'}</ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录你的解题思路..."
            className="w-full resize-y text-sm font-mono outline-none bg-transparent"
            style={{
              minHeight: 120,
              color: 'var(--text-primary)',
              border: 'none',
              lineHeight: 1.6,
            }}
          />
        )}
      </div>
    </div>
  )
}
