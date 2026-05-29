import type { ProblemSummary, ProblemDetail, SubmitResult } from '../types'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}


// ── User endpoints ──────────────────────────────────────────

export function listProblems(): Promise<ProblemSummary[]> {
  return get<ProblemSummary[]>('/problems')
}

export function getProblem(id: string): Promise<ProblemDetail> {
  return get<ProblemDetail>(`/problems/${encodeURIComponent(id)}`)
}

export function submitCode(problemId: string, code: string): Promise<SubmitResult> {
  return post<SubmitResult>('/submit', { problem_id: problemId, code })
}

// ── Admin endpoints ─────────────────────────────────────────

export interface AdminProblem {
  id: string
  title: string
  mode: string
  method: string
  time_limit: number
  difficulty: string
  starter_code: string
  test_cases: Record<string, unknown>[]
  readme: string
}

export function getAdminProblem(id: string): Promise<AdminProblem> {
  return get<AdminProblem>(`/admin/problems/${encodeURIComponent(id)}`)
}

export function updateProblem(id: string, data: Record<string, unknown>): Promise<{ ok: boolean }> {
  return put<{ ok: boolean }>(`/admin/problems/${encodeURIComponent(id)}`, data)
}

export function updateReadme(id: string, content: string): Promise<{ ok: boolean }> {
  return put<{ ok: boolean }>(`/admin/problems/${encodeURIComponent(id)}/readme`, { content })
}

export function createProblem(data: {
  id: string
  difficulty: string
  mode: string
  markdown: string
}): Promise<{ ok: boolean; id: string; title: string; test_case_count: number }> {
  return post<{ ok: boolean; id: string; title: string; test_case_count: number }>('/admin/problems', data)
}

// ── Stats & Heatmap endpoints ───────────────────────────────

export interface AdminStats {
  total: number
  easy: number
  medium: number
  hard: number
  solved: number
  pass_rate: number
}

export interface DifficultyStats {
  easy: { total: number; solved: number }
  medium: { total: number; solved: number }
  hard: { total: number; solved: number }
  overall: { total: number; solved: number }
}

export interface HeatmapEntry {
  date: string
  count: number
}

export interface TrendEntry {
  week: string
  total_submissions: number
  pass_rate: number
}

export function getAdminStats(): Promise<AdminStats> {
  return get<AdminStats>('/admin/stats')
}

export function getSubmissionHeatmap(): Promise<HeatmapEntry[]> {
  return get<HeatmapEntry[]>('/submissions/heatmap')
}

export function getDifficultyStats(): Promise<DifficultyStats> {
  return get<DifficultyStats>('/stats/difficulty')
}

export function getSubmissionTrend(): Promise<TrendEntry[]> {
  return get<TrendEntry[]>('/stats/trend')
}

export function batchUpdateProblems(ids: string[], updates: Record<string, unknown>): Promise<{ ok: boolean; updated: number; errors: string[] }> {
  return post<{ ok: boolean; updated: number; errors: string[] }>('/admin/problems/batch', { ids, updates })
}

export function deleteProblem(id: string): Promise<{ ok: boolean }> {
  return del<{ ok: boolean }>(`/admin/problems/${encodeURIComponent(id)}`)
}

export function importProblems(): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return post<{ ok: boolean; stdout: string; stderr: string }>('/admin/import', {})
}
