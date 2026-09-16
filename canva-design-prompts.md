# Canva Prompts — "HireLab-style" design set

A heads-up before using these: Canva's AI design generation (posters, docs, presentations, social
posts, etc.) is not a UI-mockup tool — it won't produce a literally interactive-looking dashboard
with real sidebars and draggable kanban cards the way Figma or the reference images do. These
prompts get you the same *visual language* — light blue gradient background, black browser-frame
device mockup, white rounded card, blue accent color, clean sans-serif type — as a static design
(poster/social/doc), not a functional UI file. If you actually want pixel-level app screens like
the reference images, that's a UI design tool job (Figma), not Canva.

Use these with Claude connected to Canva. Paste one prompt at a time.

---

## Style reference (used in every prompt below)

- Background: soft light-blue gradient (top-left pale blue fading to a deeper sky blue bottom-right)
- Foreground: a black-bordered browser/device frame containing a white, rounded-corner UI panel
- Accent color: blue (#0E87FE-ish), used for active nav states, buttons, and highlighted stage tags
- Secondary accent tags: purple (screening), orange/red (interview/tests), green (hired)
- Typography: clean modern sans-serif, sentence case, small caps section labels top-left (e.g. "/OVERVIEW"), page numbers top-right
- Overall mood: minimal, professional, SaaS-product-marketing style

---

## Prompt 1 — Cover / title slide

```
Create a Canva design (design_type: presentation, 1 slide) for a SaaS product cover slide.

Background: soft gradient from pale sky blue (top-left) to deeper blue (bottom-right).
Center-top: large bold black title text "HR RECRUITMENT PORTAL".
Top-left small label: "2024". Top-right small label: "UX/UI".
Below the title, centered: a black-bordered laptop/browser frame mockup containing a white
dashboard UI preview — sidebar navigation on the left with icons, a "Welcome" header, and a
card-based content area with a kanban-style pipeline list.
Keep it minimal, flat, no shadows or 3D effects. Modern SaaS product-marketing aesthetic.
```

---

## Prompt 2 — Overview / about slide

```
Create a Canva design (design_type: presentation, 1 slide) as a project overview slide.

Same soft blue gradient background as before.
Top-left label: "/OVERVIEW", top-right: "01".
Centered heading: "ABOUT THE PROJECT" in bold black caps.
Below it, a short centered paragraph describing an HR recruitment portal offering job creation,
applicant tracking, candidate pipeline management, messaging, calendar, and hiring analytics.
Below the text, a black-bordered laptop mockup showing a white dashboard UI: left sidebar nav,
a candidate kanban board with 5 columns (New applied, Screening, Interview, Tests, Hired), each
column containing small candidate cards with an avatar circle, name, and a 5-star rating row.
```

---

## Prompt 3 — Dashboard screen mockup

```
Create a Canva design (design_type: presentation, 1 slide) showing a dashboard UI mockup inside
a browser-frame device.

Background: soft blue gradient. Top-left label "/DASHBOARD", top-right "02".
Inside a black-bordered browser frame: a white rounded dashboard UI with:
- top bar: app name "HireLab" left, search bar center, notification and profile icons right
- left sidebar: icon-only nav (dashboard, briefcase, tools, media, analytics, settings)
- main area: "Dashboards" heading, two tabs "Overview" / "Reports"
- a row of 4 small metric cards (Reach, Visits, Avg time on site, New applicants)
- two line-chart cards side by side ("Engagement score", "Applicants goal")
- a row of 3 "active campaign" cards, each with a job title, a colored toggle switch, and an
  applicant count
- a horizontal "sources" bar chart (Mobile, Tablet, Upwork, Desktop, Website, Instagram,
  LinkedIn, Facebook) with a circular progress ring showing total vacancies
- right side panel: a small calendar widget and a scrollable list of today's interview
  schedule items with colored time blocks
Flat design, no shadows, blue and white color scheme with small purple/orange/green accent tags.
```

---

## Prompt 4 — Candidate pipeline / kanban table slide

```
Create a Canva design (design_type: presentation, 1 slide) showing a candidate tracking table
UI inside a browser-frame device.

Background: soft blue gradient. Top-left label "/CANDIDATES: TABLE VIEW", top-right "05".
Inside the browser frame: a white panel titled "Design Lead" with sub-tabs "Job details",
"Candidates" (active, underlined blue), "Application form", and top-right buttons "Basics",
"Editor", "Form", "Tools", and a solid blue "Publish" button.
Below: "Total Candidates 26" heading, filter chips ("All candidates", "Filter name"), a search
bar, and a toggle between "Table" and "Pipeline" view.
Main content: a table with columns Candidate Name (with avatar), Stages (colored pill showing
step count, e.g. purple "New Applied 1/5", blue "Interview 3/5", green "Hired 5/5"), Applied
date, Position applied to, and a 5-star Rating column. Show 8 sample rows. Include pagination
controls at the bottom.
Flat, clean, minimal shadows, blue/white/purple/orange/green palette.
```

---

## Prompt 5 — Candidate profile detail panel

```
Create a Canva design (design_type: presentation, 1 slide) showing a candidate profile side
panel over a blurred dashboard background.

Background: soft blue gradient, with a faded/blurred dashboard UI behind a black-bordered
device frame. Top-left label "/CANDIDATE PROFILE VIEW", top-right "07".
In the foreground, a white rounded panel titled "Candidate profile view" with a close (X) icon
top-right. Inside: a circular avatar photo, candidate name in bold, a status pill ("New
Applied") with a colored stage progress row (numbered circles 1-5, some filled red/orange),
and two buttons "Chat" and "Send email".
Below, tabs: "Overview", "Resume" (active), "Notes".
Content: email and phone with small icons, a location line, then an "Experience" timeline list
with role titles, companies, and date ranges, each with a short description line. At the
bottom, a small file attachment row showing a PDF icon, filename, and file size.
Bottom of panel: "Previous candidate" and "Next candidate" navigation buttons.
```

---

## Prompt 6 — Messages / inbox screen

```
Create a Canva design (design_type: presentation, 1 slide) showing a messaging UI inside a
browser-frame device.

Background: soft blue gradient. Top-left label "/MESSAGES", top-right "08".
Inside the frame: top bar with app name and search bar, left sidebar icon nav.
Main layout in 3 columns:
1. Left: "Messages" heading with a search bar and a scrollable list of conversation previews,
   each with avatar, name, last message snippet, timestamp, and an unread-count badge.
2. Center: an open conversation thread with a candidate's name and role at top, chat bubbles
   alternating left (candidate, white bubble) and right (recruiter, solid blue bubble), a date
   divider, and a message input bar at the bottom with an attachment icon and a blue send button.
3. Right: a candidate summary sidebar with avatar, name, "Applied for" job title, a stage
   progress pill row, contact details, and a small upcoming-schedule list (interview,
   assessment) with date/time.
Flat, minimal, blue and white with soft gray text for secondary info.
```

---

## Prompt 7 — Job/vacancy creation flow

```
Create a Canva design (design_type: presentation, 1 slide) showing a job posting creation
editor UI, split into an editor panel and a live preview panel.

Background: soft blue gradient. Top-left label "/VACANCY CREATION", top-right "09".
Inside a browser frame: top bar shows job title "Sr. Technical Engineer", a status toggle, and
top-right buttons "Basic", "Page", "Form", and a solid blue "Publish" button.
Left panel "Editor": labeled input fields for Header and Sub Header (with character counters),
and a drag-and-drop image upload zone with two uploaded image rows showing filename, size, and
a progress bar. "Back" and "Save & Next" buttons at the bottom.
Right panel "Preview": toggle between "Mobile"/"Desktop", showing a live preview of a company
page section with a heading, subheading, and a 2x4 grid of photo thumbnails, each captioned
"Event held in company".
Flat, clean, blue and white, minimal shadows.
```

---

## Prompt 8 — Company/brand profile setup

```
Create a Canva design (design_type: presentation, 1 slide) showing a brand/company profile
setup screen with a step indicator.

Background: soft blue gradient. Top-left label "/COMPANY PROFILE CREATION", top-right "12".
Top bar: app name "HireLab" left, a 3-step horizontal progress indicator center ("Brand Style"
done/checked, "Hiring team", "Location"), and "Log in" / "Invite your colleague" buttons right.
Left panel "Brand Style": labeled text fields for Company Name, Company URL, Company
Information, a drag-and-drop logo upload zone, a text-style selector (H1/H2/H3 radio options),
and a "Brand Colors" row showing 3 small color swatches with hex codes and an "Add color" button.
"Back" and "Save & Next" buttons at the bottom.
Right panel: a large empty dashed-border "Preview area" placeholder box.
Flat, minimal, blue and white palette with small pops of red/purple/blue in the color swatches.
```

---

## Tips for using these

- Run them one at a time — Canva's generator does better with one focused screen per call than
  a combined multi-screen brief.
- If a result comes back too generic, add explicit color hex values (e.g. "#0E87FE blue accent")
  and re-run — Canva responds well to concrete color/typography constraints.
- These are marketing/presentation-style renders of the UI, good for pitch decks, portfolio
  pages, or stakeholder walkthroughs — not something you'd hand to a frontend dev as a spec.
  For that, the HR Interview Portal build spec and mockups from earlier in this conversation are
  the more useful reference.
