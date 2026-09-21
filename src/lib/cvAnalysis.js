// Rule-based CV analysis: no LLM/API call — regex/date-math heuristics
// over the resume text already extracted by resumeParser.js, flagging
// employment gaps, overlapping dates, and inconsistent date formatting,
// then suggesting interview questions from the question library (falling
// back to a templated question per flag). Manual/on-demand only, wired to
// an "Analyze CV" button — never run automatically, same "not a source of
// truth" philosophy as resumeParser.js itself.

const MONTH_NAMES = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'
const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

// Matches "Jan 2020 - Mar 2022", "January 2020 – Present", "2019 - 2021",
// etc. Two formats side by side: "Mon YYYY" and bare "YYYY".
const RANGE_RE = new RegExp(
  `((?:${MONTH_NAMES})[a-z]*\\.?\\s+\\d{4}|\\d{4})\\s*(?:-|–|to)\\s*((?:${MONTH_NAMES})[a-z]*\\.?\\s+\\d{4}|present|current|\\d{4})`,
  'gi'
)

function parseDatePoint(str, isEnd) {
  const s = str.trim().toLowerCase()
  if (isEnd && (s === 'present' || s === 'current')) return { date: new Date(), label: 'Present', hadMonth: true }

  const monthMatch = s.match(new RegExp(`^(${MONTH_NAMES})[a-z]*\\.?\\s+(\\d{4})$`))
  if (monthMatch) {
    const month = MONTH_INDEX[monthMatch[1]]
    const year = Number(monthMatch[2])
    return { date: new Date(year, month, 1), label: str.trim(), hadMonth: true }
  }

  const yearMatch = s.match(/^(\d{4})$/)
  if (yearMatch) {
    const year = Number(yearMatch[1])
    return { date: new Date(year, isEnd ? 11 : 0, 1), label: str.trim(), hadMonth: false }
  }
  return null
}

// Returns [{ start: Date, end: Date, startLabel, endLabel, hadMonth }],
// sorted chronologically. Best-effort — resumes that don't use a
// "date - date" convention simply yield no periods (analysis then only
// reports "no employment history detected"), not a crash.
export function extractEmploymentPeriods(text) {
  const periods = []
  let match
  RANGE_RE.lastIndex = 0
  while ((match = RANGE_RE.exec(text)) !== null) {
    const start = parseDatePoint(match[1], false)
    const end = parseDatePoint(match[2], true)
    if (!start || !end || end.date < start.date) continue
    periods.push({
      start: start.date,
      end: end.date,
      startLabel: start.label,
      endLabel: end.label,
      hadMonth: start.hadMonth && end.hadMonth,
    })
  }
  return periods.sort((a, b) => a.start - b.start)
}

function monthsBetween(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const GAP_THRESHOLD_MONTHS = 2

// Returns { gaps, overlaps, formatIssues, flags, periods }. `flags` is a
// flat list of { type, detail } used both for display and for matching
// against the question library.
export function analyzeCv(text) {
  const periods = extractEmploymentPeriods(text || '')
  const gaps = []
  const overlaps = []
  const flags = []

  for (let i = 1; i < periods.length; i++) {
    const prev = periods[i - 1]
    const curr = periods[i]
    const gapMonths = monthsBetween(prev.end, curr.start)
    if (gapMonths >= GAP_THRESHOLD_MONTHS) {
      const gap = { from: formatMonthYear(prev.end), to: formatMonthYear(curr.start), months: gapMonths }
      gaps.push(gap)
      flags.push({ type: 'employment_gap', detail: gap })
    } else if (gapMonths < 0) {
      const overlap = { from: formatMonthYear(curr.start), to: formatMonthYear(prev.end) }
      overlaps.push(overlap)
      flags.push({ type: 'overlap', detail: overlap })
    }
  }

  const formatIssues = []
  const mixedFormat = periods.some((p) => p.hadMonth) && periods.some((p) => !p.hadMonth)
  if (mixedFormat) {
    formatIssues.push('Employment dates are formatted inconsistently (some entries give month + year, others only a year).')
    flags.push({ type: 'format_inconsistency', detail: {} })
  }

  if (periods.length === 0) {
    flags.push({ type: 'no_employment_history', detail: {} })
  }

  return { periods, gaps, overlaps, formatIssues, flags, analyzedAt: new Date().toISOString() }
}

const FLAG_TEMPLATES = {
  employment_gap: (f) => `There's a gap of about ${f.detail.months} month(s) between ${f.detail.from} and ${f.detail.to} — can you walk me through what you were doing during that time?`,
  overlap: (f) => `Two roles appear to overlap around ${f.detail.from}–${f.detail.to} — can you clarify the timeline here?`,
  format_inconsistency: () => 'Can you confirm the exact start and end dates (month and year) for each role on your CV?',
  no_employment_history: () => "I couldn't find a clear work history on your CV — can you walk me through your career so far?",
}

const FLAG_TO_STAGE_NAME = {
  employment_gap: 'employment_gap',
  overlap: 'employment_gap',
  format_inconsistency: 'employment_gap',
  no_employment_history: 'employment_gap',
}

// Builds suggested questions: for each flag, tries the question library
// first (role + a fixed flag->stage_name tag convention), falling back to
// a templated question. `libraryQuestions` is the already-fetched list
// from questionLibrary.listQuestions({ roleCategory }) so this function
// stays a pure helper with no data access of its own.
export function suggestQuestions(report, libraryQuestions = []) {
  const suggestions = []
  for (const flag of report.flags) {
    const stageName = FLAG_TO_STAGE_NAME[flag.type]
    const fromLibrary = libraryQuestions.find((q) => q.stage_name === stageName)
    suggestions.push({
      flagType: flag.type,
      question: fromLibrary ? fromLibrary.question_text : FLAG_TEMPLATES[flag.type](flag),
      source: fromLibrary ? 'library' : 'generated',
    })
  }
  return suggestions
}
