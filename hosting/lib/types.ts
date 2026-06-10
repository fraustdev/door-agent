export interface AccessLogRow {
  id: string
  created_at: string
  caller_id: string
  word_spoken: string
  word_expected: string | null
  match_distance: number | null
  granted: boolean
  locked_out: boolean
  granted_by: string | null
  is_injection: boolean
}

export interface LockoutInfo {
  callerId: string
  msRemaining: number
}

export interface StatusData {
  currentWord: string | null
  lockouts: LockoutInfo[]
}

export interface SlackVisitor {
  id: string
  created_at: string
  name: string
  added_by: string | null
  date: string
}

export interface DayStat {
  date: string
  day: string
  granted: number
  denied: number
  locked: number
  total: number
}
