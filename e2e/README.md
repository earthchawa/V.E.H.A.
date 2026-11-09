# End-to-end tests

Playwright suites that drive the real app (browser + server + PostgreSQL), one file per area in `suites/`.

```bash
npm run build                                   # the runner starts `next start` on the build
npm run test:e2e                                # every suite (≈15 min)
npm run test:e2e -- 05-quiz 10-code-questions   # only some, by file-name prefix
```

- **Every suite empties the database first** and loads the demo data (`e2e/reseed.mjs`) with
  `DEMO_PASSWORD` (default `Demo-start-2569`). Use a local, disposable database in `.env` — the runner
  refuses hosted ones unless `E2E_ALLOW_REMOTE_DB=1`.
- Needs `psql`, Playwright and Chromium (pre-installed in the Claude Code cloud container).
- Set `E2E_BASE_URL` to test a server you started yourself. Screenshots go to `e2e/.out/` (gitignored).
- `fixtures/` holds **synthetic** import files (same shape and counts as real ones, fake names and IDs).
  Never commit real staff or cadet lists or real default passwords.
- A suite prints `PASS …` per check and ends with `ALL OK`; anything else counts as a failure.
- `20-mobile-overflow` runs at 360, 390 and 1024 px and fails on any horizontal page scroll.

When you change a user flow, update or add a suite here in the same commit.
