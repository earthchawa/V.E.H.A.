# Feature notes (for developers and Claude)

Details of individual features, moved out of `CLAUDE.md` so they are not loaded into every session.
Read the section for the area you are changing.

## Features

- **Copy between sections** goes through `<CopyToSections kind=…>`: a dialog that names the item, shows each other
  section with its instructor and cadet count, and lists what is and is not copied.
- **Year levels:** `CadetYear` holds one row per cadet per academic year (history is kept). `currentAcademicYear()` =
  the current semester's year. Set from the user CSV (7th column `year`, which also fills it in for existing cadets),
  the create form or the Manage dialog; "Move cadets up a year" (`promoteCadetsAction`, pure `planPromotion`) adds next
  year's rows, graduates the final year (default 4) and is safe to run twice.
- **Deleting a section** (`deleteOfferingAction`, admin, roster page): type the course code to confirm; audit first,
  then delete, then remove stored files.
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
- **Admin screens:** Users = role tabs + live filters (`<FilterBar>`), grouped by department, one "Manage" dialog per
  person (edit username/name/role/email/department — audited as `user.updated` with from/to — reset password,
  disable). Semesters & courses = semester chips (current / upcoming) with sections grouped by subject area, plus a
  course-catalogue tab. Instructors see an "upcoming semester" notice on the dashboard to prepare ahead.
- **Gradebook (instructor):** tabs Scores | Grading setup (`?view=setup`); setup is 3 steps: categories & weights
  (template button when empty), graded work = score-table columns (`GradeItem`), letter grades.

## Status

Phases 1–4 done, plus quiz code questions (Python, JavaScript, HTML/CSS/JS; hand-marked): accounts, terms/courses/sections, materials, assignments + similarity reports (peer
copying only), gradebook, online quizzes with integrity log / Safe Exam Browser / exam rooms, divisions &
departments with logos and colours. In-house "reference library" per assignment: instructors add earlier terms' / other sections' runs of the
same course (past cadets anonymised in reports) and reference texts (web pages, model answers, AI-chatbot answers;
pasted text is tokenised as prose and as code). It feeds the overall similarity score.
Not done: automatic internet search and AI-writing detection (would need Copyleaks or similar, deferred until
there is a budget; plug it in as another source kind feeding SourceMatch; AI hints must be a yellow,
instructor-only "for review" highlight — never an accusation), department-level admins.
