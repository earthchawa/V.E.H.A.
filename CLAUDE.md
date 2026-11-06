# V.E.H.A. — Virtual Educational Hangar for Air-cadets (NKRAFA online classroom)

In-house online classroom for Navaminda Kasatriyadhiraj Royal Thai Air Force Academy (NKRAFA).
Started with Computer Science cadets (~20 per year, ~80 total), meant to grow to other divisions.
The project owner writes in Thai; reply in Thai. UI copy exists in English and Thai.

## Stack

- Next.js 16 (App Router, Server Actions, Turbopack) + React 19 + TypeScript (strict) + Tailwind CSS 4
- PostgreSQL 16 via Prisma 6 (`prisma/schema.prisma`)
- Vitest for unit tests; Playwright (pre-installed in the cloud container) for end-to-end checks
- Quiz code questions use CodeMirror 6 (`components/code/`) and run only in the browser: Python with Pyodide
  (self-hosted — `scripts/copy-pyodide.mjs` copies it to `public/pyodide` before dev/build; gitignored),
  JavaScript in a worker, HTML/CSS/JS in a sandboxed iframe (`public/runners/`, `lib/code.ts`). No server execution.
- The sign-in pages use a three.js scene (`components/LoginScene.tsx`, loaded only there; honours reduced motion)
- Self-hosted with Docker Compose (`Dockerfile`, `docker-compose.yml`); a public demo runs on Vercel + Neon

## Commands

```bash
npm run dev            # http://localhost:3000
npm run build          # production build (also type-checks)
npm run typecheck
npm test               # vitest
npm run db:deploy      # apply migrations
npm run db:seed:demo   # demo data; prints temporary passwords (or uses DEMO_PASSWORD)
npm run vercel-build   # what Vercel runs: migrate (unpooled) → optional demo seed → build
```

Local dev needs `.env` (copy `.env.example`; set `COOKIE_SECURE="false"` for http://localhost).

## Layout

```
prisma/schema.prisma, migrations/, seed.ts, demo-assignments.ts
src/app/
  login, change-password, forgot-password, reset-password   # auth pages (outside the app shell)
  exam/[attemptId]/                                          # distraction-free quiz page + its actions
  (app)/                                                     # signed-in shell (nav, prefs)
    page.tsx                                                 # dashboard: "For you" panel + courses by department
    courses/[id]/  (materials) assignments/ quizzes/ grades/ # course tabs; each has actions.ts
    admin/  users/ courses/ offerings/[id]/ departments/ exam-settings/ audit/  + actions.ts
  api/                                                       # file downloads, gradebook CSV export
src/components/   Modal, KeepForm, FileDropzone, SubmitButton, ReportView, AnswerView, …
src/lib/
  auth/           password policy, sessions (hashed tokens), lockout, reset links
  i18n/           en.ts (source of keys), th.ts (must cover every key), server.ts/client.tsx
  similarity/     tokenizer (Thai via Intl.Segmenter), k-gram engine, file text extraction, highlights,
                  reference library (sources.ts; one-way matches against SimilaritySource → SourceMatch)
  quiz.ts         pure quiz logic (auto-grading, layout, deadlines, IP/SEB checks)  + quiz-server.ts (DB side)
  grades.ts       pure gradebook maths; sections.ts copy between sections; todo.ts dashboard queries
  access.ts       offeringAccess (manage/view) and canGrade (course instructors only)
```

## Conventions (follow these)

- **Every user-facing string goes through i18n.** Add the key to `src/lib/i18n/en.ts` and the same key to
  `th.ts` (TypeScript fails otherwise; a test checks placeholders match). Server code returns `Msg` keys or
  calls `getI18n()`; client components use `useI18n()`. Dates via `date()`, terms via `term()` from the
  translator (Bangkok time; Thai mode shows Buddhist-era dates).
- **Forms:** use `useActionState` + `<KeepForm>` (not `<form action>`): React 19 resets forms after an action,
  which would wipe typed input on validation errors. `resetOnSuccess` / `closeOnSuccess` as needed.
- **Create/edit UIs open in `<Modal>`** (native `<dialog>`). File inputs use `<FileDropzone>`.
- **Permissions are checked in every server action**, not just hidden in the UI:
  - `offeringAccess` → `"manage"` (admin or course instructor) / `"view"` (enrolled cadet) / null.
  - `canGrade` → only the course's own instructors may change grades, gradebook setup, report grading,
    quiz marking and attempt resets. Admins get read-only views (+ CSV export).
  - Cadets only ever see their own submissions, reports (peers anonymised) and released grades.
- **Audit** sensitive actions with `audit({ actorId, action, … })` (logins, passwords, grades with from/to,
  admin changes). `audit()` resolves the entry's course section and department from `targetType`/`targetId`
  (pass `offeringId` when the target was just deleted). New actions need a `log.<action>` label in i18n and a
  prefix in `AUDIT_CATEGORIES` (`lib/audit-filter.ts`; a unit test checks this).
- **Time inputs** are Bangkok local (`parseBangkokLocal` / `toBangkokLocal` in `lib/assignments.ts`).
- **Storage:** `lib/storage.ts` — `disk` (self-hosted, `UPLOAD_DIR`) or `db` (Postgres, default on Vercel).
  Upload cap `config.maxUploadMb` (4 MB on Vercel); forms check sizes in the browser first.
- **Database URL** may arrive under integration-specific names; `lib/db-url.ts` normalises it.
- **Exams** use full-screen browser mode with a supervising instructor. Safe Exam Browser support is kept but
  switched off (`config.sebEnabled`, env `SEB_ENABLED=true`); use `sebRequired(quiz)`, never `quiz.requireSeb`.
  The exam page blocks copy/paste/drop in the capture phase (so editors can't bypass it) and does not count
  focus moving into a code preview iframe as leaving the quiz.
- **Mobile:** every page must work at 360–390 px wide with no horizontal page scroll. Below `lg` the app header
  collapses into `<MobileMenu>`; wide tables sit in `overflow-x-auto`, or become stacked rows.
- **Styling:** semantic tokens in `src/app/globals.css` (`bg-surface`, `text-muted`, `text-danger`, …) with a
  light theme under `[data-theme="light"]`. Don't hard-code palette colours for text.
- **Organisation:** two levels — department (กองวิชา, e.g. "Department of Computer Science" (CS),
  "Department of Mathematics and Computer Science" (MC)) and subject area (สาขาวิชา, e.g. MA under MC, PH and CH
  under MS); in code both are `Department` rows (`parentId` = level 2). Keep the English "Department of …" naming.
  The brand (name V.E.H.A. = Virtual Educational Hangar for Air-cadets, formerly SkyCampus/AeroClass, + Academic Faculty logo, transparent; `logoDark` variant with light lettering for the
  dark theme — no white plate) lives in `lib/brand.ts`.
- **Department branding:** each unit has a colour and a logo (bundled under `public/logos/`, or
  uploaded — PNG/JPG/WebP ≤ 1 MB, served by `/api/department-logo/[id]`). Subject areas inherit their department's
  colour/logo unless set. Use `courseTheme(code, department)` / `deptLogo()` from `lib/departments.ts`
  (falls back to a stable `cc-N` colour); inside, use `cc-bar` / `cc-text` / `cc-tint` (`--cc-fg` keeps text
  readable in both themes). The 10 academy departments live in `ACADEMY_DIVISIONS` (subject areas in
  `ACADEMY_SUBJECT_AREAS`) and are seeded by `npm run db:seed` without overwriting admin edits. Mathematics & Computer and Computer Science are grey by the owner's request.
- Demo seed must stay **idempotent** (it runs on every Vercel build when `DEMO_SEED=true`).

## Migrations

`prisma migrate dev` refuses to run non-interactively when it has warnings. Instead generate SQL from the
existing migrations with a shadow DB, then apply:

```bash
mkdir prisma/migrations/$(date -u +%Y%m%d%H%M%S)_name
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" --script > prisma/migrations/<that folder>/migration.sql
npx prisma migrate deploy && npx prisma generate
```

Commit every migration; Vercel applies them during build.

## Testing

- `npm test` covers pure logic (auth policy, CSV, similarity incl. Thai Q&A, grades, quiz logic, i18n parity).
- End-to-end checks were run with Playwright scripts against `next start` + a seeded local Postgres
  (login/first-password flow, materials, assignments + similarity reports, gradebook, sections, quizzes,
  admin features). Those scripts are not in the repo yet; re-create them when changing user flows, and
  reseed with `npm run db:seed:demo` before each run (first logins change demo passwords).
- In the cloud container Postgres may need restarting after the container restarts.

## Status

Phases 1–4 done, plus quiz code questions (Python, JavaScript, HTML/CSS/JS; hand-marked): accounts, terms/courses/sections, materials, assignments + similarity reports (peer
copying only), gradebook, online quizzes with integrity log / Safe Exam Browser / exam rooms, divisions &
departments with logos and colours. In-house "reference library" per assignment: instructors add earlier terms' / other sections' runs of the
same course (past cadets anonymised in reports) and reference texts (web pages, model answers, AI-chatbot answers;
pasted text is tokenised as prose and as code). It feeds the overall similarity score.
Not done: automatic internet search and AI-writing detection (would need Copyleaks or similar, deferred until
there is a budget; plug it in as another source kind feeding SourceMatch; AI hints must be a yellow,
instructor-only "for review" highlight — never an accusation), department-level admins.
