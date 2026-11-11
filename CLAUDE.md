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
- **Create/edit UIs open in `<Modal>`** (native `<dialog>`, animated in/out via `dialog.modal` in globals.css). File
  inputs use `<FileDropzone>`. On/off settings are switches: `<input type="checkbox" role="switch" className="toggle">`
  (plain checkboxes only for picking several items). Destructive actions ask with `<ConfirmForm>` — never
  `window.confirm()`. A form that closes its modal on success confirms with `toast()` (`<Toaster>` in the app shell).
- **Lists that open something** (assignments, quizzes) are cards whose title link covers the card (`after:absolute
  after:inset-0`), with explicit action buttons on top (`relative z-[1]`). A quiz has two big tabs, Questions | Results
  (`<QuizTabs>`).
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
- **Storage:** `lib/storage.ts` — NEW files go to `disk` (self-hosted, `UPLOAD_DIR`), `blob` (private Vercel Blob;
  the default once `BLOB_READ_WRITE_TOKEN` is set) or `db` (Postgres; Vercel without Blob). Reads go by the key's
  shape (`f/<uuid>` / `u/<userId>/<uuid>` = Blob, bare uuid = legacy store), so never assume the current driver.
  Upload cap `config.maxUploadMb` (4 MB on Vercel without Blob, else 50); forms check sizes in the browser first.
  File forms use `<KeepForm directUpload>` and actions read files with `incomingFiles(fd, field, user)`
  (`lib/uploads.ts`) — with Blob the browser uploads first and posts a reference; never read `fd.get("file")`
  directly. Downloads stream through the permission-checked routes (`openStoredFile`).
- **Backups:** Admin → System downloads the database (gzipped NDJSON, `lib/backup.ts`) and a tar of uploaded files;
  `scripts/restore-backup.ts` restores both. Tables are discovered from `pg_tables`, so new models need nothing.
- **AI reference answers** (`lib/ai-answers.ts`, only with `ANTHROPIC_API_KEY`): sends the assignment text only,
  stores answers as `DOCUMENT` sources titled "AI · …". A comparison aid — never present it as AI detection.
- **Database URL** may arrive under integration-specific names; `lib/db-url.ts` normalises it.
- **Exams** use full-screen browser mode with a supervising instructor. Safe Exam Browser support is kept but
  switched off (`config.sebEnabled`, env `SEB_ENABLED=true`); use `sebRequired(quiz)`, never `quiz.requireSeb`.
  The exam page blocks copy/paste/drop in the capture phase (so editors can't bypass it) and does not count
  focus moving into a code preview iframe as leaving the quiz.
- **Mobile:** every page must work at 360–390 px wide with no horizontal page scroll. Below `lg` the app header
  collapses into `<MobileMenu>`; wide tables sit in `overflow-x-auto`, or become stacked rows.
- **Styling:** semantic tokens in `src/app/globals.css` (`bg-surface`, `text-muted`, `text-danger`, …) with a
  light theme under `[data-theme="light"]`. Don't hard-code palette colours for text.
- **Wording:** English UI says "semester" (never "term"; the model is still `Term`); Thai says ภาคเรียน.
- **Help text:** explanations go in an `<InfoTip>` (ⓘ, hover/focus/tap) next to the title or label, or `PageHeader
  help=`, not as paragraphs. Keep only step-by-step instructions inside import dialogs visible.
- **Navigation:** `<BackButton>` (history first, else `parentPath()` from `lib/nav.ts`; add new routes without their
  own page there). App shell: above the page, hidden on top-menu pages (`NAV_ROOTS`). Inside a course: under the
  course tabs, only on detail pages (`isCourseDetail`), labelled with where it goes (`backTarget`). Don't add per-page "← …" links. The header uses the AF emblem
  (`brand.mark`); the full faculty badge is only for the sign-in page.
- Demo seed must stay **idempotent** (it runs on every Vercel build when `DEMO_SEED=true`).

## Git

- Before the first commit in a session, set the author to the owner's GitHub noreply address so commits count
  as their contributions (keep the Co-Authored-By trailer):
  `git config user.name "earthchawa" && git config user.email "257072870+earthchawa@users.noreply.github.com"`
- `main` is the default branch and Vercel's production branch (demo: https://veha-nkrafa.vercel.app; the old
  nkrafa-ai-classroom.vercel.app redirects there). Work on a feature branch and merge into `main` to deploy.

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

## Documentation

`docs/` holds the software documentation (Thai): `technical/` (software design, operations, developer guide) and
`manual/` (cadet, instructor, admin). Manuals quote the Thai UI labels from `th.ts`; when a flow or label changes,
update the matching manual (and the SDD for design changes) only when the owner asks, or batch it at the end of a
feature — not on every small change. No real names, IDs or passwords.
Feature details (sections, year levels, organisation & branding, curriculum, bulk import, admin screens, gradebook,
project status / what is not done) are in `docs/technical/feature-notes.md` — read the relevant part when working there.

## Testing

- `npm test` covers pure logic (auth policy, CSV, similarity incl. Thai Q&A, grades, quiz logic, year levels, i18n parity).
- End-to-end suites live in `e2e/` (`npm run build && npm run test:e2e`, see `e2e/README.md`): 22 Playwright suites
  (~360 checks) against `next start` + the local Postgres, reseeded before each suite with `DEMO_PASSWORD`.
  **Keep them in the repo and up to date**: when a user flow changes, update/add a suite in the same commit and run
  only the affected suites. Run the full set only when the owner asks. Fixtures are synthetic — never real people or passwords.
- In the cloud container Postgres may need restarting after the container restarts.

## Keeping usage low

- Do only what was asked; don't widen the scope (extra refactors, docs, full test runs) without asking.
- Send long command output to a file and show only the summary or failures, e.g.
  `npm run build > /tmp/build.log 2>&1; tail -20 /tmp/build.log` and `npm test 2>&1 | tail -30`.
- Prefer `npm run typecheck` / targeted `npx vitest run <file>` over a full build when that is enough.
- Read files by the part you need (grep first) rather than whole large files; don't spawn subagents unless asked.
