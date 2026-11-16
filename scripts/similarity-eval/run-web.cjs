#!/usr/bin/env node
// Runs the similarity experiment through the real web UI of a V.E.H.A. site (local or deployed):
//   1. admin imports test accounts (one instructor + N cadets, synthetic) and a one-row schedule (test course),
//   2. the instructor creates one assignment per task (T1, T2, P1, P2, ...),
//   3. each test cadet signs in and submits one file per task (files from make-variants.mjs),
//   4. the instructor's compare page is read for every pair in pairs.csv, with "ignore common passages"
//      on (the default) and then off; scores go to scores.csv, screenshots to the output folder.
//
//   VEHA_URL=https://… VEHA_ADMIN_PASSWORD=… node scripts/similarity-eval/run-web.cjs <dataset-dir>
//
// Env: VEHA_URL (default http://localhost:3000), VEHA_ADMIN_USER (admin), VEHA_ADMIN_PASSWORD (required),
//      EXP_PREFIX (simtest), EXP_COURSE (SIM901), EXP_YEAR (2569), EXP_SEMESTER (1).
// Re-running is safe: accounts, course and assignments are reused, files are resubmitted.
// Output: <dataset-dir>/web-run/ — credentials.json (test-account passwords: keep private), mapping.csv,
//         scores.csv, run-log.txt, *.png. Never put real cadet data in the dataset.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");

const dir = process.argv[2];
if (!dir) throw new Error("usage: run-web.cjs <dataset-dir>");
const BASE = (process.env.VEHA_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN = process.env.VEHA_ADMIN_USER || "admin";
const ADMIN_PW = process.env.VEHA_ADMIN_PASSWORD;
if (!ADMIN_PW) throw new Error("Set VEHA_ADMIN_PASSWORD (the admin's current password).");
const PREFIX = process.env.EXP_PREFIX || "simtest";
const COURSE = process.env.EXP_COURSE || "SIM901";
const YEAR = process.env.EXP_YEAR || "2569";
const SEM = process.env.EXP_SEMESTER || "1";

const OUT = path.join(dir, "web-run");
fs.mkdirSync(OUT, { recursive: true });
const logFile = path.join(OUT, "run-log.txt");
const log = (...a) => {
  const line = `[${new Date().toISOString()}] ${a.join(" ")}`;
  console.log(line);
  fs.appendFileSync(logFile, line + "\n");
};

// ---------- dataset ----------
const subDir = path.join(dir, "submissions");
const tasks = fs.readdirSync(subDir).filter((t) => fs.statSync(path.join(subDir, t)).isDirectory()).sort();
const files = Object.fromEntries(tasks.map((t) => [t, fs.readdirSync(path.join(subDir, t)).sort()]));
const pairs = fs.readFileSync(path.join(dir, "pairs.csv"), "utf8").trim().split("\n").slice(1).map((l) => l.split(","));
const nCadets = Math.max(...tasks.map((t) => files[t].length));
const cadets = Array.from({ length: nCadets }, (_, i) => `${PREFIX}${String(i + 1).padStart(2, "0")}`);
const teacher = `${PREFIX}-t`;

// ---------- passwords (kept between runs) ----------
const credFile = path.join(OUT, "credentials.json");
const creds = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, "utf8")) : {};
const pw = () => crypto.randomBytes(9).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 10) + "7k";
for (const u of [teacher, ...cadets]) creds[u] ??= { initial: pw(), final: pw() };
fs.writeFileSync(credFile, JSON.stringify(creds, null, 2));

(async () => {
  const browser = await chromium.launch();
  const page = async () => (await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "en-US" })).newPage();
  const done = (p) => p.waitForURL((u) => !/\/(login|change-password)/.test(u.pathname), { timeout: 30000 });

  /** Sign in; on a first sign-in, change the temporary password to the final one. */
  const signIn = async (user, passwords) => {
    const p = await page();
    for (const attempt of passwords) {
      await p.goto(BASE + "/login");
      await p.fill("#username", user);
      await p.fill("#password", attempt.pw);
      await p.click("button[type=submit]");
      await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 8000 }).catch(() => {});
      if (p.url().includes("/change-password")) {
        if (!attempt.next) throw new Error(`${user} must change the password first (do it in the browser, then re-run).`);
        await p.fill("#currentPassword", attempt.pw);
        await p.fill("#newPassword", attempt.next);
        await p.fill("#confirmPassword", attempt.next);
        await p.click("button[type=submit]");
      }
      if (!new URL(p.url()).pathname.startsWith("/login")) {
        await done(p);
        return p;
      }
    }
    throw new Error(`cannot sign in as ${user}`);
  };
  const asTestUser = (u) => signIn(u, [{ pw: creds[u].final }, { pw: creds[u].initial, next: creds[u].final }]);

  /** Click the import button of the open dialog and wait until the server has finished (hashing passwords takes a while). */
  const importAndWait = async (p) => {
    const btn = p.locator("dialog[open] button[type=submit]").last();
    await btn.click();
    await p.waitForFunction(
      () => {
        const b = [...document.querySelectorAll("dialog[open] button[type=submit]")].at(-1);
        return !b || (!b.disabled && !/Importing|กำลังนำเข้า|…/.test(b.textContent ?? ""));
      },
      null,
      { timeout: 180000 },
    );
    await p.waitForTimeout(1000);
  };

  // ---------- 1. accounts + test course (admin) ----------
  const ADMIN_NEW = process.env.VEHA_ADMIN_NEW_PASSWORD; // only for a fresh site whose admin still has the temporary password
  const ad = await signIn(ADMIN, ADMIN_NEW ? [{ pw: ADMIN_NEW }, { pw: ADMIN_PW, next: ADMIN_NEW }] : [{ pw: ADMIN_PW }]);
  log("signed in as", ADMIN, "at", BASE);
  const usersCsv = path.join(OUT, "accounts-import.csv");
  fs.writeFileSync(
    usersCsv,
    "username,fullName,role,email,department,password\n" +
      `${teacher},อาจารย์ทดสอบการตรวจความคล้าย,instructor,,,${creds[teacher].initial}\n` +
      cadets.map((u, i) => `${u},ชุดทดสอบ ${String(i + 1).padStart(2, "0")},cadet,,,${creds[u].initial}`).join("\n") + "\n",
  );
  await ad.goto(BASE + "/admin/users");
  await ad.getByTestId("import-users").click();
  await ad.locator("#csv-file").setInputFiles(usersCsv);
  await importAndWait(ad);
  await ad.screenshot({ path: path.join(OUT, "01-import-accounts.png"), fullPage: true });
  await ad.keyboard.press("Escape");
  log("accounts imported (existing ones are skipped):", teacher, cadets[0] + "…" + cadets.at(-1));

  const schedCsv = path.join(OUT, "schedule-import.csv");
  fs.writeFileSync(
    schedCsv,
    "year,semester,code,title_th,title_en,credits,section,instructors,cadets\n" +
      `${YEAR},${SEM},${COURSE},ทดสอบความแม่นยำการตรวจความคล้าย,Similarity Check Evaluation,0,1,${teacher},${cadets.join(" ")}\n`,
  );
  await ad.goto(BASE + "/admin/courses");
  await ad.getByTestId("import-schedule").click();
  await ad.locator("#sched-file").setInputFiles(schedCsv);
  await importAndWait(ad);
  await ad.screenshot({ path: path.join(OUT, "02-import-schedule.png"), fullPage: true });
  log("schedule imported:", `${COURSE} ${YEAR}/${SEM} section 1`);

  // ---------- 2. assignments (instructor) ----------
  const tp = await asTestUser(teacher);
  // The dashboard opens on the current semester; if the test course is in another one, try the semester tabs.
  await tp.goto(BASE + "/");
  const termLinks = await tp.$$eval('a[href*="term="]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  const courseLink = () =>
    tp.$$eval("a[href^='/courses/']", (as, code) => as.find((a) => /^\/courses\/[^/]+$/.test(a.getAttribute("href")) && a.textContent.includes(code))?.getAttribute("href"), COURSE);
  let coursePath = null;
  for (const href of [null, ...termLinks]) {
    if (href) await tp.goto(new URL(href, BASE).toString());
    if ((coursePath = await courseLink())) break;
  }
  if (!coursePath) throw new Error(`${teacher} does not see ${COURSE} on the dashboard`);
  const courseUrl = BASE + coursePath;
  const asgUrl = {};
  for (const task of tasks) {
    const title = `${PREFIX}-${task}`;
    await tp.goto(courseUrl + "/assignments");
    const link = tp.getByRole("link", { name: title, exact: true });
    if (await link.count()) {
      await link.first().click();
    } else {
      await tp.getByTestId("new-assignment").click();
      const form = tp.locator("dialog[open]");
      await form.locator("#a-title").fill(title);
      await form.locator("#a-instructions").fill(`ชุดทดสอบการตรวจความคล้าย โจทย์ ${task} (บัญชีทดสอบเท่านั้น)`);
      await form.locator("#a-due").fill("2099-12-31T23:59");
      const check = form.locator("input[name=checkSimilarity]");
      if (!(await check.isChecked())) await check.check();
      const common = form.locator("input[name=ignoreCommon]");
      if (!(await common.isChecked())) await common.check();
      await form.locator("button[type=submit]").click();
    }
    await tp.waitForURL(/assignments\/[^/]+$/);
    asgUrl[task] = tp.url();
    log("assignment", title, asgUrl[task]);
  }

  // ---------- 3. submissions (test cadets) ----------
  const mapping = [["task", "file", "account"]];
  for (let i = 0; i < cadets.length; i++) {
    const u = cadets[i];
    const cp = await asTestUser(u);
    for (const task of tasks) {
      const f = files[task][i];
      if (!f) continue;
      await cp.goto(asgUrl[task]);
      await cp.locator("#s-files").setInputFiles(path.join(subDir, task, f));
      await cp.getByRole("button", { name: /^(Submit|Resubmit|ส่งงาน|ส่งงานใหม่)$/ }).click();
      await cp.getByText(/^(Submitted\.|ส่งงานแล้ว)$/).first().waitFor({ timeout: 60000 });
      mapping.push([task, f, u]);
      log("submitted", task, f, "as", u);
    }
    if (i === 0) {
      await cp.goto(asgUrl[tasks[0]]);
      await cp.screenshot({ path: path.join(OUT, "03-cadet-submitted.png"), fullPage: true });
    }
    await cp.context().close();
  }
  fs.writeFileSync(path.join(OUT, "mapping.csv"), mapping.map((r) => r.join(",")).join("\n") + "\n");
  const accountOf = new Map(mapping.slice(1).map(([t, f, u]) => [`${t}/${f}`, u]));

  // ---------- 4. read pair scores (instructor) ----------
  const subIds = async (task) => {
    await tp.goto(asgUrl[task]);
    return new Map(
      await tp.$$eval("table tbody tr", (rows) =>
        rows
          .map((r) => [r.querySelector("td span.font-mono")?.textContent?.trim(), r.querySelector('a[href*="/report/"]')?.getAttribute("href")?.split("/report/")[1]])
          .filter(([u, id]) => u && id),
      ),
    );
  };
  const pctOf = (s) => Number(String(s).replace(/[^\d.]/g, "")) / 100;
  const readScores = async (label) => {
    const scores = new Map();
    for (const task of tasks) {
      const ids = await subIds(task);
      for (const [t, a, b] of pairs.filter((p) => p[0] === task)) {
        const ia = ids.get(accountOf.get(`${t}/${a}`));
        const ib = ids.get(accountOf.get(`${t}/${b}`));
        if (!ia || !ib) throw new Error(`no submission for ${t} ${a} / ${b}`);
        await tp.goto(`${asgUrl[task]}/compare?a=${ia}&b=${ib}`);
        const shares = await tp.locator("section.card span.text-danger").allTextContents();
        scores.set(`${t},${a},${b}`, shares.map(pctOf));
      }
      await tp.goto(asgUrl[task]);
      await tp.screenshot({ path: path.join(OUT, `04-${task}-instructor-${label}.png`), fullPage: true });
      log("read", pairs.filter((p) => p[0] === task).length, "pairs of", task, `(ignoreCommon ${label})`);
    }
    return scores;
  };
  const setIgnoreCommon = async (on) => {
    for (const task of tasks) {
      await tp.goto(asgUrl[task]);
      await tp.getByTestId("assignment-more").click();
      await tp.getByTestId("edit-assignment").click();
      const box = tp.locator("dialog[open] input[name=ignoreCommon]");
      if ((await box.isChecked()) !== on) await box.click();
      await tp.locator("dialog[open] button[type=submit]").click();
      await tp.locator("dialog[open]").waitFor({ state: "hidden", timeout: 60000 });
    }
    log("ignoreCommon set to", on);
  };

  await setIgnoreCommon(true);
  const on = await readScores("on");
  await setIgnoreCommon(false);
  const off = await readScores("off");
  await setIgnoreCommon(true); // leave the assignments at the default setting

  const rows = [["task", "a", "b", "label", "level", "on_a", "on_b", "off_a", "off_b"]];
  for (const [t, a, b, label, level] of pairs) rows.push([t, a, b, label, level, ...on.get(`${t},${a},${b}`), ...off.get(`${t},${a},${b}`)]);
  fs.writeFileSync(path.join(OUT, "scores.csv"), rows.map((r) => r.join(",")).join("\n") + "\n");

  // A sample compare page per level of the first task, for the article.
  const ids = await subIds(tasks[0]);
  for (const [t, a, b, , level] of pairs.filter((p) => p[0] === tasks[0] && p[3] === "1")) {
    await tp.goto(`${asgUrl[t]}/compare?a=${ids.get(accountOf.get(`${t}/${a}`))}&b=${ids.get(accountOf.get(`${t}/${b}`))}`);
    await tp.screenshot({ path: path.join(OUT, `05-compare-${b.replace(/\.\w+$/, "")}.png`), fullPage: true });
  }
  log("done:", rows.length - 1, "pairs →", path.join(OUT, "scores.csv"));
  await browser.close();
})().catch((e) => {
  log("ERROR", e.stack || e);
  process.exit(1);
});
