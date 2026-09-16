// Simple regex/keyword extraction to pre-fill the application form from an
// uploaded resume — a nice-to-have (Section 2/9), not a source of truth.
// Candidate/HR-entered data always wins over what's parsed here.

import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages = []
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => item.str).join(' '))
  }
  return pages.join('\n')
}

async function extractDocxText(file) {
  const buffer = await file.arrayBuffer()
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer })
  return value
}

function guessName(text) {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 1 && line.length < 60 && !EMAIL_RE.test(line) && !PHONE_RE.test(line))
  return firstLine || null
}

// Returns { text, name, email, phone } — any field may be null if it
// couldn't be extracted. Throws if the file type/text extraction fails;
// callers should treat that as "parsing unavailable", not a hard error.
export async function parseResume(file) {
  let text = ''
  if (file.type === 'application/pdf') {
    text = await extractPdfText(file)
  } else if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    text = await extractDocxText(file)
  } else {
    throw new Error('Unsupported file type for parsing')
  }

  const emailMatch = text.match(EMAIL_RE)
  const phoneMatch = text.match(PHONE_RE)

  return {
    text: text.slice(0, 4000),
    name: guessName(text),
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0].trim() : null,
  }
}
