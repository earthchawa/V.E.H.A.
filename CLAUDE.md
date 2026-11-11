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
- **Copy between sections** goes through `<CopyToSections kind=…>`: a dialog that names the item, shows each other
  section with its instructor and cadet count, and lists what is and is not copied.
- **Year levels:** `CadetYear` holds one row per cadet per academic year (history is kept). `currentAcademicYear()` =
  the current semester's year. Set from the user CSV (7th column `year`, which also fills it in for existing cadets),
  the create form or the Manage dialog; "Move cadets up a year" (`promoteCadetsAction`, pure `planPromotion`) adds next
  year's rows, graduates the final year (default 4) and is safe to run twice.
- **Deleting a section** (`deleteOfferingAction`, admin, roster page): type the course code to confirm; audit first,
  then delete, then remove stored files.
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
- **Organisation:** two levels — department (กองวิชา, e.g. "Department of Mathematics and Computer Science" (MC))
  and subject area (ภาควิชา in Thai, e.g. CS ภาควิชาคอมพิวเตอร์ and MA ภาควิชาคณิตศาสตร์ under MC; PH and CH under MS);
  in code both are `Department` rows (`parentId` = level 2). Keep the English "Department of …" naming.
  The brand (name V.E.H.A. = Virtual Educational Hangar for Air-cadets, formerly SkyCampus/AeroClass; Academic
  Faculty badge, transparent, `logoDark` variant with light lettering for the dark theme — no white plate; `mark`
  = AF emblem for small sizes) lives in `lib/brand.ts`.
- **Department branding:** each unit has a colour and a logo (bundled under `public/logos/`, or
  uploaded — PNG/JPG/WebP ≤ 1 MB, served by `/api/department-logo/[id]`). Subject areas inherit their department's
  colour/logo unless set. Use `courseTheme(code, department)` / `deptLogo()` from `lib/departments.ts`
  (falls back to a stable `cc-N` colour); inside, use `cc-bar` / `cc-text` / `cc-tint` (`--cc-fg` keeps text
  readable in both themes). The 10 academy departments live in `ACADEMY_DIVISIONS` (subject areas in
  `ACADEMY_SUBJECT_AREAS`) and are seeded by `npm run db:seed` without overwriting admin edits. Mathematics & Computer is grey by the owner's request.
- **Curriculum:** real courses from the curriculum book live in `lib/curriculum.ts` (คต → CS, คณ → MA; electives
  numbered "xxx" left out). `db:seed` creates missing ones; existing databases got them from the
  `*_curriculum_cs_ma` migration (generated from the list; a test keeps them in step). Add other departments'
  courses the same way: extend the list and add a new data migration. Demo courses CS201/CS202/MA101 are demo-only.
- **Bulk set-up (admin):** Users → Import from CSV (`username, fullName, role, email, department, password, year`; the
  optional starting password must still be changed at first sign-in) and Terms & courses → Import teaching
  schedule (`year, semester, code, title_th, title_en, credits, section, instructors`; Thai codes such as คต 231
  map to CS231; creates missing terms/courses/sections, enrols instructors, never changes existing rows, so
  re-importing is safe). Real staff/cadet lists are uploaded through these screens — never commit them.
- **Wording:** English UI says "semester" (never "term"; the model is still `Term`); Thai says ภาคเรียน.
- **Admin screens:** Users = role tabs + live filters (`<FilterBar>`), grouped by department, one "Manage" dialog per
  person (edit username/name/role/email/department — audited as `user.updated` with from/to — reset password,
  disable). Semesters & courses = semester chips (current / upcoming) with sections grouped by subject area, plus a
  course-catalogue tab. Instructors see an "upcoming semester" notice on the dashboard to prepare ahead.
- **Gradebook (instructor):** tabs Scores | Grading setup (`?view=setup`); setup is 3 steps: categories & weights
  (template button when empty), graded work = score-table columns (`GradeItem`), letter grades.
- **Help text:** explanations go in an `<InfoTip>` (ⓘ, hover/focus/tap) next to the title or label, or `PageHeader
  help=`, not as paragraphs. Keep only step-by-step instructions inside import dialogs visible.
- **Navigation:** `<BackButton>` (history first, else `parentPath()` from `lib/nav.ts`; add new routes without their
  own page there). App shell: above the page, hidden on top-menu pages (`NAV_ROOTS`). Inside a course: under the
  course tabs, only on detail pages (`isCourseDetail`), labelled with where it goes (`backTarget`). Don't add per-page "← …" links. The header uses the AF emblem
  (`brand.mark`); the full faculty badge is only for the sign-in page.
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

## Documentation

`docs/` holds the software documentation (Thai): `technical/` (software design, operations, developer guide) and
`manual/` (cadet, instructor, admin). Manuals quote the Thai UI labels from `th.ts`; when a flow or label changes,
update the matching manual (and the SDD for design changes) in the same commit. No real names, IDs or passwords.

## Testing

- `npm test` covers pure logic (auth policy, CSV, similarity incl. Thai Q&A, grades, quiz logic, year levels, i18n parity).
- End-to-end suites live in `e2e/` (`npm run build && npm run test:e2e`, see `e2e/README.md`): 22 Playwright suites
  (~360 checks) against `next start` + the local Postgres, reseeded before each suite with `DEMO_PASSWORD`.
  **Keep them in the repo and up to date**: when a user flow changes, update/add a suite in the same commit and run
  the affected suites (all of them before a larger push). Fixtures are synthetic — never real people or passwords.
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
