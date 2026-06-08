export interface AccessLogRow {
  id: string
  created_at: string
  caller_id: string
  word_spoken: string
  word_expected: string | null
  match_distance: number | null
  granted: boolean
  locked_out: boolean
}

export interface LockoutInfo {
  callerId: string
  msRemaining: number
}

export interface StatusData {
  currentWord: string | null
  lockouts: LockoutInfo[]
}

export interface VisitorWindow {
  firstName: string
  displayName: string
  meetingTitle: string
  meetingStart: string
  meetingEnd: string
  windowStart: string
  windowEnd: string
  calendarOwner: string
  active: boolean
}

export interface CalendarConnection {
  email: string
  display_name: string | null
  created_at: string
}

export interface DayStat {
  date: string
  day: string
  granted: number
  denied: number
  locked: number
  total: number
}
