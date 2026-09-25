// Simple keyword-match "ATS" score — no AI, per Section 2/9's stance on
// keeping v1 scoring manual and non-AI. This is a supplementary signal
// for ranking multiple applicants to the same job, not a replacement
// for the manual `score`/`rating` fields, which remain the source of
// truth (same "don't derive one from the other" principle as rating).
//
// v2 goes beyond flat unigram overlap (which scored "not" and "React"
// identically and couldn't tell "3 years" from "10 years") by adding:
//   - phrase (bigram) matching, so multi-word skills like "machine
//     learning" or "project management" count once, together, instead
//     of as two unrelated single words:
//   - weighting keywords pulled from the job's structured Requirements
//     list higher than ones only mentioned in free-text description,
//     since HR marked those as the things that actually matter;
//   - a seniority/years-of-experience check: if the job asks for "5+
//     years" and the resume's highest mentioned figure is lower (or
//     absent), that's flagged as a gap without changing the underlying
//     keyword math.
// All of it stays deterministic string/regex matching — still no AI,
// still just a ranking aid.

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

// Adjacent-word phrases from the ORIGINAL (untokenized-but-lowercased)
// word stream, so stopwords still break phrases the way a reader would
// expect ("years of React experience" -> "react experience" isn't
// really a phrase in the source), while surviving ones like "machine
// learning" or "customer success" get captured as a single unit.
function bigrams(text) {
  const words = tokenize(text)
  const out = []
  for (let i = 0; i < words.length - 1; i++) {
    out.push(`${words[i]} ${words[i + 1]}`)
  }
  return out
}

// Unique, meaningful keywords describing what the job actually needs —
// pulled from free-text requirements/description plus the structured
// "Requirements" bullets from the job page builder. Structured bullets
// are kept separate from the free-text corpus so callers can weight
// them differently (HR wrote those as explicit must-haves).
function jobKeywordSources(job) {
  const requirementsList = (job.requirements_list ?? []).map((r) => r.label).join(' ')
  const freeText = [job.description, job.requirements].filter(Boolean).join(' ')
  return { requirementsList, freeText }
}

// Back-compat: flat, unweighted keyword list (still used anywhere that
// only needs "what are the job's keywords", not a score).
export function extractJobKeywords(job) {
  const { requirementsList, freeText } = jobKeywordSources(job)
  return [...new Set(tokenize([freeText, requirementsList].join(' ')))]
}

const YEARS_RE = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)/gi

// Highest "N years/yrs" figure mentioned in a block of text, or null if
// none is mentioned. Used to compare what a job asks for against what a
// resume claims.
function maxYearsMentioned(text) {
  if (!text) return null
  let max = null
  for (const match of text.matchAll(YEARS_RE)) {
    const n = Number(match[1])
    if (!Number.isNaN(n) && (max === null || n > max)) max = n
  }
  return max
}

// Returns a detailed breakdown: overall 0-100 score, which keywords/
// phrases matched vs. are missing (split by whether they came from the
// structured Requirements list or free text), and a seniority
// comparison. Returns null when there's nothing to compare (no job
// keywords, or no parsed resume text to match against) — same contract
// as the old computeMatchScore.
export function computeMatchDetails(job, resumeText) {
  const { requirementsList, freeText } = jobKeywordSources(job)
  const requiredWords = [...new Set(tokenize(requirementsList))]
  const freeTextWords = [...new Set(tokenize(freeText))].filter((w) => !requiredWords.includes(w))
  const requiredPhrases = [...new Set(bigrams(requirementsList))]
  const freeTextPhrases = [...new Set(bigrams(freeText))].filter((p) => !requiredPhrases.includes(p))

  if (requiredWords.length + freeTextWords.length + requiredPhrases.length + freeTextPhrases.length === 0) {
    return null
  }
  if (!resumeText) return null

  const resumeWords = new Set(tokenize(resumeText))
  const resumePhraseSet = new Set(bigrams(resumeText))

  // Weights: a structured "Requirement" bullet counts 3x a free-text
  // mention, and a matched phrase counts 2x a matched single word (a
  // two-word skill hit is stronger evidence than one word landing by
  // coincidence).
  const WEIGHTS = { requiredWord: 3, freeTextWord: 1, requiredPhrase: 6, freeTextPhrase: 2 }

  const matchedRequiredWords = requiredWords.filter((w) => resumeWords.has(w))
  const matchedFreeTextWords = freeTextWords.filter((w) => resumeWords.has(w))
  const matchedRequiredPhrases = requiredPhrases.filter((p) => resumePhraseSet.has(p))
  const matchedFreeTextPhrases = freeTextPhrases.filter((p) => resumePhraseSet.has(p))

  const earned =
    matchedRequiredWords.length * WEIGHTS.requiredWord +
    matchedFreeTextWords.length * WEIGHTS.freeTextWord +
    matchedRequiredPhrases.length * WEIGHTS.requiredPhrase +
    matchedFreeTextPhrases.length * WEIGHTS.freeTextPhrase

  const possible =
    requiredWords.length * WEIGHTS.requiredWord +
    freeTextWords.length * WEIGHTS.freeTextWord +
    requiredPhrases.length * WEIGHTS.requiredPhrase +
    freeTextPhrases.length * WEIGHTS.freeTextPhrase

  const score = possible > 0 ? Math.round((earned / possible) * 100) : null

  const jobYears = maxYearsMentioned(`${requirementsList} ${freeText}`)
  const resumeYears = maxYearsMentioned(resumeText)
  const seniority =
    jobYears == null
      ? null
      : {
          requiredYears: jobYears,
          resumeYears,
          meetsRequirement: resumeYears != null && resumeYears >= jobYears,
        }

  return {
    score,
    matchedRequiredKeywords: [...matchedRequiredWords, ...matchedRequiredPhrases],
    missingRequiredKeywords: requiredWords.filter((w) => !resumeWords.has(w)).concat(
      requiredPhrases.filter((p) => !resumePhraseSet.has(p))
    ),
    matchedOtherKeywords: [...matchedFreeTextWords, ...matchedFreeTextPhrases],
    seniority,
  }
}

// Returns an integer 0-100, or null when there's nothing to compare —
// same contract as before, now backed by the weighted/phrase-aware
// scorer above. Kept as the primary export since both call sites only
// need the headline number.
export function computeMatchScore(job, resumeText) {
  const details = computeMatchDetails(job, resumeText)
  return details ? details.score : null
}
