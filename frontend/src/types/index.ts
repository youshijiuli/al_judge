export interface ProblemSummary {
  id: string
  title: string
  mode: 'stdio' | 'core_code'
  difficulty: string
  desc_preview: string
  status: 'accepted' | 'attempted' | 'unattempted'
}

export interface ProblemDetail {
  id: string
  title: string
  mode: 'stdio' | 'core_code'
  method: string
  time_limit: number
  difficulty: string
  description: string
  starter_code: string
  public_test_cases: { input: unknown }[]
}

export interface CaseResult {
  id: number
  passed: boolean
  runtime_ms: number
  input: string
  expected: string
  actual: string
  error: string
}

export interface SubmitResult {
  id: string
  problem_id: string
  time: string
  code: string
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Syntax Error'
  syntax_error?: string
  passed: number
  total: number
  max_runtime_ms: number
  cases: CaseResult[]
  error: string
}
