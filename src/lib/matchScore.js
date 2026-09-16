// Simple keyword-match "ATS" score — no AI, per Section 2/9's stance on
// keeping v1 scoring manual and non-AI. This is a supplementary signal
// for ranking multiple applicants to the same job, not a replacement
// for the manual `score`/`rating` fields, which remain the source of
// truth (same "don't derive one from the other" principle as rating).

const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','than','so','of','to','in','on','for',
  'with','at','by','from','as','is','are','was','were','be','been','being','this',
  'that','these','those','it','its','you','your','we','our','they','their','he','she',
  'his','her','will','shall','can','could','should','would','may','might','must',
  'have','has','had','do','does','did','not','no','yes','into','about','over','under',
  'up','down','out','all','any','each','more','most','other','some','such','only',
  'own','same','too','very','just','also','per','years','year','experience','work',
  'working','ability','strong','excellent','required','preferred','plus','etc',
])

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
}

// Unique, meaningful keywords describing what the job actually needs —
// pulled from free-text requirements/description plus the structured
// "Requirements" bullets from the job page builder.
export function extractJobKeywords(job) {
  const requirementsList = (job.requirements_list ?? []).map((r) => r.label).join(' ')
  const corpus = [job.description, job.requirements, requirementsList].filter(Boolean).join(' ')
  return [...new Set(tokenize(corpus))]
}

// Returns an integer 0-100, or null when there's nothing to compare
// (no job keywords, or no parsed resume text to match against).
export function computeMatchScore(job, resumeText) {
  const keywords = extractJobKeywords(job)
  if (keywords.length === 0 || !resumeText) return null

  const resumeWords = new Set(tokenize(resumeText))
  const matched = keywords.filter((k) => resumeWords.has(k)).length
  return Math.round((matched / keywords.length) * 100)
}
