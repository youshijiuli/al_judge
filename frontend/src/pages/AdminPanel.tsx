import { useState, useEffect, useCallback } from 'react'
import { listProblems, getAdminProblem, updateProblem, updateReadme, createProblem, type AdminProblem } from '../lib/api'
import type { ProblemSummary } from '../types'
import Editor from '@monaco-editor/react'

export default function AdminPanel() {
  const [problems, setProblems] = useState<ProblemSummary[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminProblem | null>(null)
  const [loading, setLoading] = useState(false)
  const [readme, setReadme] = useState('')
  const [configText, setConfigText] = useState('')
  const [saving, setSaving] = useState<'config' | 'readme' | null>(null)
  const [msg, setMsg] = useState('')

  // New problem modal
  const [showNew, setShowNew] = useState(false)
  const [newId, setNewId] = useState('')
  const [newMode, setNewMode] = useState('stdio')
  const [newDifficulty, setNewDifficulty] = useState('medium')
  const [newMarkdown, setNewMarkdown] = useState('')

  useEffect(() => {
    listProblems().then(setProblems).catch(() => {})
  }, [])

  const filtered = problems.filter(
    (p) => !search || p.title.includes(search) || p.id.includes(search)
  )

  const openProblem = useCallback(async (id: string) => {
    setLoading(true)
    setMsg('')
    try {
      const data = await getAdminProblem(id)
      setSelected(data)
      setConfigText(JSON.stringify(
        {
          id: data.id,
          title: data.title,
          mode: data.mode,
          method: data.method,
          time_limit: data.time_limit,
          difficulty: data.difficulty,
          starter_code: data.starter_code,
          test_cases: data.test_cases,
        },
        null, 2
      ))
      setReadme(data.readme || '')
    } catch (e: unknown) {
      setMsg('加载失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }, [])

  const saveConfig = useCallback(async () => {
    if (!selected) return
    setSaving('config')
    setMsg('')
    try {
      const parsed = JSON.parse(configText)
      await updateProblem(selected.id, parsed)
      setMsg('config.json 已保存')
    } catch (e: unknown) {
      setMsg('保存失败: ' + (e instanceof Error ? e.message : '格式错误'))
    } finally {
      setSaving(null)
    }
  }, [selected, configText])

  const saveReadme = useCallback(async () => {
    if (!selected) return
    setSaving('readme')
    setMsg('')
    try {
      await updateReadme(selected.id, readme)
      setMsg('README.md 已保存')
    } catch (e: unknown) {
      setMsg('保存失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setSaving(null)
    }
  }, [selected, readme])

  const handleCreate = useCallback(async () => {
    if (!newId.trim() || !newMarkdown.trim()) return
    setMsg('')
    try {
      await createProblem({
        id: newId.trim(),
        mode: newMode,
        difficulty: newDifficulty,
        markdown: newMarkdown.trim(),
      })
      setShowNew(false)
      setMsg('题目已创建')
      listProblems().then(setProblems).catch(() => {})
      openProblem(newId.trim())
    } catch (e: unknown) {
      setMsg('创建失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }, [newId, newMode, newDifficulty, newMarkdown, openProblem])

  const T = { bg: 'var(--bg-primary)', bg2: 'var(--bg-secondary)', border: 'var(--border-primary)', text: 'var(--text-primary)', text2: 'var(--text-secondary)', text3: 'var(--text-tertiary)', blue: 'var(--blue)', green: 'var(--green)', red: 'var(--red)' }

  return (
    <div className="h-screen flex flex-col" style={{ background: T.bg, color: T.text }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ background: T.bg2, borderBottom: `1px solid ${T.border}` }}
      >
        <a href="/" className="text-sm no-underline transition-colors" style={{ color: T.text3 }}
           onMouseEnter={(e) => { e.currentTarget.style.color = T.text }}
           onMouseLeave={(e) => { e.currentTarget.style.color = T.text3 }}>
          ← 返回前台
        </a>
        <h1 className="font-semibold text-base" style={{ color: '#fff' }}>题目管理</h1>
        <button
          onClick={() => { setShowNew(true); setNewId(''); setNewMode('stdio'); setNewDifficulty('medium'); setNewMarkdown('') }}
          className="lc-btn text-xs font-medium"
          style={{ background: T.blue, color: '#fff' }}
        >
          + 新增题目
        </button>
        {selected && (
          <span className="text-sm ml-4 truncate" style={{ color: T.text3 }}>
            编辑: {selected.title}
          </span>
        )}
        {msg && (
          <span
            className="text-sm ml-auto"
            style={{ color: msg.includes('失败') ? 'var(--red)' : 'var(--green)' }}
          >
            {msg}
          </span>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: problem list */}
        <div
          className="w-72 shrink-0 flex flex-col"
          style={{ background: T.bg2, borderRight: `1px solid ${T.border}` }}
        >
          <div className="p-3" style={{ borderBottom: `1px solid ${T.border}` }}>
            <input
              type="text"
              placeholder="搜索题目..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="lc-input w-full"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => openProblem(p.id)}
                className="w-full text-left px-3 py-2.5 text-sm transition-colors border-0 cursor-pointer"
                style={{
                  background: selected?.id === p.id ? 'var(--blue-bg)' : 'transparent',
                  borderBottom: `1px solid ${T.border}`,
                  borderLeft: selected?.id === p.id ? '3px solid var(--blue)' : '3px solid transparent',
                  color: T.text,
                }}
              >
                <div className="font-medium truncate" style={{ color: '#fff' }}>{p.title}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color: T.text3 }}>{p.id}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: editors */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading && (
            <div className="flex justify-center items-center h-full" style={{ color: T.text3 }}>
              加载中...
            </div>
          )}

          {!selected && !loading && (
            <div className="flex justify-center items-center h-full text-sm" style={{ color: T.text3 }}>
              从左侧选择题目开始编辑
            </div>
          )}

          {selected && (
            <>
              {/* Toolbar */}
              <div
                className="flex items-center gap-3 px-4 py-2 shrink-0"
                style={{ background: T.bg2, borderBottom: `1px solid ${T.border}` }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.text3 }}>
                  Config.json
                </span>
                <button
                  onClick={saveConfig}
                  disabled={saving === 'config'}
                  className="lc-btn text-xs"
                  style={{ background: T.blue, color: '#fff', opacity: saving === 'config' ? 0.5 : 1 }}
                >
                  {saving === 'config' ? '保存中...' : '保存 Config'}
                </button>
                <span style={{ color: T.border }}>|</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.text3 }}>
                  README.md
                </span>
                <button
                  onClick={saveReadme}
                  disabled={saving === 'readme'}
                  className="lc-btn text-xs"
                  style={{ background: T.blue, color: '#fff', opacity: saving === 'readme' ? 0.5 : 1 }}
                >
                  {saving === 'readme' ? '保存中...' : '保存 Readme'}
                </button>
              </div>

              {/* Dual editors */}
              <div className="flex-1 flex overflow-hidden">
                <div className="w-1/2" style={{ borderRight: `1px solid ${T.border}` }}>
                  <Editor
                    height="100%"
                    language="json"
                    value={configText}
                    onChange={(v) => setConfigText(v || '')}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', Consolas, monospace",
                      minimap: { enabled: false },
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      tabSize: 2,
                      automaticLayout: true,
                    }}
                  />
                </div>
                <div className="w-1/2">
                  <Editor
                    height="100%"
                    language="markdown"
                    value={readme}
                    onChange={(v) => setReadme(v || '')}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', Consolas, monospace",
                      minimap: { enabled: false },
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      tabSize: 2,
                      wordWrap: 'on',
                      automaticLayout: true,
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New problem modal */}
      {showNew && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'var(--bg-overlay)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNew(false) }}
        >
          <div
            className="rounded-xl shadow-2xl p-6 w-[760px] animate-[fadeIn_0.15s_ease]"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#fff' }}>
              新增题目 — 粘贴 Markdown
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    题目 ID（英文，如 two-sum）
                  </label>
                  <input
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="lc-input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>模式</label>
                  <select value={newMode} onChange={(e) => setNewMode(e.target.value)} className="lc-select">
                    <option value="stdio">标准 I/O</option>
                    <option value="core_code">核心代码</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>难度</label>
                  <select value={newDifficulty} onChange={(e) => setNewDifficulty(e.target.value)} className="lc-select">
                    <option value="easy">简单</option>
                    <option value="medium">中等</option>
                    <option value="hard">困难</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Markdown 内容（标题、描述、示例测试用例）
                </label>
                <div className="rounded-md overflow-hidden" style={{ height: 380, border: `1px solid var(--border-primary)` }}>
                  <Editor
                    height="100%"
                    language="markdown"
                    value={newMarkdown}
                    onChange={(v) => setNewMarkdown(v || '')}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', Consolas, monospace",
                      minimap: { enabled: false },
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      automaticLayout: true,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowNew(false)} className="lc-btn lc-btn-ghost text-sm">
                取消
              </button>
              <button onClick={handleCreate} className="lc-btn lc-btn-primary text-sm">
                创建题目
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
