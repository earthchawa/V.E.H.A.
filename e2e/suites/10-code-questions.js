const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const firstLogin = async (u, np, vp = { width: 1360, height: 900 }) => {
    const p = await (await browser.newContext({ viewport: vp })).newPage();
    p.on('pageerror', (e) => errors.push(u + ': ' + e.message));
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };
  const setCode = async (ws, text) => {
    const ed = ws.locator('.cm-content:visible').first();
    await ed.click();
    await ws.page().keyboard.press('ControlOrMeta+A');
    await ws.page().keyboard.press('Delete');
    await ws.page().keyboard.insertText(text);
  };

  // ---------- Instructor: SEB hidden, code question type available ----------
  const tp = await firstLogin('T0001', 'Teach3rPass');
  await tp.locator('ul.grid a', { hasText: 'CS201' }).first().click(); await tp.waitForURL(/courses\/[^/]+$/);
  await tp.getByRole('link', { name: 'Quizzes' }).first().click();
  await tp.getByText('Quiz 2: Coding practice').click();
  await tp.waitForURL(/quizzes\/[^/]+$/);
  ok(await tp.getByText('Code (runs in the browser)').count() >= 2, 'code questions listed with their type');
  ok(await tp.getByText('HTML / CSS / JavaScript').count() >= 1, 'language badge shown');
  await tp.getByRole('button', { name: /Add question/ }).first().click().catch(() => {});
  const typeSel = tp.locator('select[name=type]:visible').first();
  await typeSel.selectOption('CODE');
  ok(await tp.getByTestId('code-question-fields').count() >= 1, 'question editor shows language + starter fields');
  await tp.locator('select[name=language]:visible').first().selectOption('javascript');
  ok(await tp.locator('textarea[name="starter:main.js"]:visible').count() === 1, 'starter file switches with language');
  await tp.keyboard.press('Escape');
  await tp.goto(tp.url().replace(/quizzes\/.*/, 'quizzes'));
  await tp.getByRole('button', { name: /New quiz/ }).first().click();
  ok(await tp.getByTestId('fullscreen-note').count() >= 1 && await tp.getByText('Locked-down exam (Safe Exam Browser)').count() === 0, 'quiz form: full-screen note, no SEB option');

  // ---------- Cadet takes the coding quiz ----------
  const c1 = await firstLogin('6601001', 'Cadet1Pass');
  await c1.getByTestId('cadet-todo').getByText('Quiz 2: Coding practice').click();
  await c1.getByRole('button', { name: 'Start quiz' }).click(); await c1.waitForURL(/\/exam\//);
  await c1.getByTestId('fullscreen-overlay').getByRole('button').click();
  const ws = c1.getByTestId('code-workspace');
  ok(await ws.count() === 2, 'two code workspaces');
  const py = c1.locator('[data-testid=code-workspace][data-language=python]');
  const web = c1.locator('[data-testid=code-workspace][data-language=web]');
  await py.locator('.cm-content').waitFor();
  ok((await py.locator('.cm-content').textContent()).includes('n = int(input'), 'starter code loaded in editor');

  // paste is blocked inside the editor
  await py.locator('.cm-content').click();
  await c1.evaluate(() => {
    const dt = new DataTransfer(); dt.setData('text/plain', 'PASTED');
    document.querySelector('[data-language=python] .cm-content').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  ok(!(await py.locator('.cm-content').textContent()).includes('PASTED'), 'paste into code editor blocked');

  await setCode(py, 'n = int(input("n = "))\nprint(sum(range(1, n + 1)))\n');
  await py.locator('summary', { hasText: 'Input for input()' }).click();
  await py.getByTestId('code-stdin').fill('10');
  const t0 = Date.now();
  await py.getByTestId('code-run').click();
  await py.getByTestId('code-status').filter({ hasText: /Finished in/ }).waitFor({ timeout: 60000 });
  const out = await py.getByTestId('code-output').textContent();
  ok(out.includes('n = 10') && out.includes('55'), 'python runs with input(): ' + JSON.stringify(out) + ' (' + (Date.now() - t0) + ' ms incl. load)');

  await setCode(py, 'x = 1\nprint(x / 0)\n');
  await py.getByTestId('code-run').click();
  await py.getByTestId('code-status').filter({ hasText: 'Finished with an error' }).waitFor({ timeout: 20000 });
  const err = await py.getByTestId('code-output').textContent();
  ok(err.includes('ZeroDivisionError') && err.includes('File "main.py", line 2') && !err.includes('_pyodide'), 'python error shows clean traceback with line');

  await setCode(py, 'while True:\n    pass\n');
  await py.getByTestId('code-run').click();
  await py.getByTestId('code-status').filter({ hasText: 'time limit' }).waitFor({ timeout: 20000 });
  ok((await py.getByTestId('code-output').textContent()).includes('infinite loop'), 'infinite loop stopped after time limit');
  await setCode(py, 'n = int(input("n = "))\nprint(n * (n + 1) // 2)\n');
  await py.getByTestId('code-run').click();
  await py.getByTestId('code-status').filter({ hasText: /Finished in/ }).waitFor({ timeout: 60000 });
  ok((await py.getByTestId('code-output').textContent()).includes('55'), 'runs again after a timeout (fresh runtime)');

  // web question
  await web.getByRole('tab', { name: 'script.js' }).click();
  await setCode(web, 'let n = 0;\ndocument.getElementById("add").onclick = () => {\n  n++;\n  document.getElementById("count").textContent = n;\n  console.log("clicked", n);\n};\nmissing();\n');
  await web.getByTestId('code-run').click();
  const frame = c1.frameLocator('[data-testid=code-preview]');
  await frame.locator('#add').click();
  await frame.locator('#add').click();
  ok((await frame.locator('#count').textContent()) === '2', 'web preview runs HTML/CSS/JS');
  await web.getByTestId('code-output').filter({ hasText: 'clicked 2' }).waitFor();
  const wout = await web.getByTestId('code-output').textContent();
  ok(/missing is not defined \(script\.js line 7\)/.test(wout), 'web console + error with script.js line: ' + JSON.stringify(wout));
  ok(await frame.locator('body').evaluate(() => { try { return !!parent.document; } catch { return false; } }) === false, 'preview sandboxed from the exam page');
  await c1.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor({ timeout: 10000 });
  await c1.screenshot({ path: S + '/r8-exam.png', fullPage: true });
  await c1.getByRole('button', { name: 'Submit quiz' }).first().click();
  await c1.getByTestId('confirm-submit').click();
  await c1.getByTestId('quiz-done').waitFor();

  // ---------- Instructor marks: integrity log + run the answer again ----------
  await tp.goto(B + '/');
  await tp.locator('ul.grid a', { hasText: 'CS201' }).first().click(); await tp.waitForURL(/courses\/[^/]+$/);
  await tp.getByRole('link', { name: 'Quizzes' }).first().click();
  await tp.getByTestId('quiz-row').filter({ hasText: 'Quiz 2: Coding practice' }).getByTestId('row-results').click();
  await tp.locator('tr', { hasText: '6601001' }).getByRole('link', { name: 'Review' }).click();
  await tp.waitForURL(/attempts\//);
  const body = await tp.locator('main').textContent();
  const log = await tp.getByTestId('event-log').textContent();
  ok(log.includes('Pasted text'), 'blocked paste recorded in integrity log');
  ok(!log.includes('Left the quiz window'), 'clicking into the preview is not logged as leaving the quiz: ' + log);
  const tpy = tp.locator('[data-testid=code-workspace][data-language=python]');
  await tpy.locator('.cm-content').waitFor();
  ok((await tpy.locator('.cm-content').getAttribute('contenteditable')) === 'false', 'answer shown read-only to the instructor');
  await tpy.locator('summary', { hasText: 'Input for input()' }).click();
  await tpy.getByTestId('code-stdin').fill('4');
  await tpy.getByTestId('code-run').click();
  await tpy.getByTestId('code-status').filter({ hasText: /Finished in/ }).waitFor({ timeout: 60000 });
  ok((await tpy.getByTestId('code-output').textContent()).includes('10'), 'instructor runs the cadet answer with own input');
  await tp.screenshot({ path: S + '/r8-marking.png', fullPage: true });

  // ---------- Admin: exam settings without SEB ----------
  const ad = await firstLogin('admin', 'Strong9Pass');
  await ad.goto(B + '/admin/exam-settings');
  ok(await ad.getByTestId('exam-mode-note').count() === 1 && await ad.getByText('SEB Config Keys').count() === 0, 'exam settings: SEB hidden, full-screen note shown');
  // JavaScript (console) runner
  const js = await ad.evaluate(() => Promise.all(['console.log("a", {b: 1});\nnope();', 'let x = ;'].map((code) => new Promise((res) => {
    const w = new Worker('/runners/js-worker.js'); const log = [];
    w.onmessage = (e) => { log.push(e.data); if (e.data.type === 'done') { w.terminate(); res(log); } };
    w.postMessage({ id: 1, code });
  }))));
  ok(js[0].some((m) => m.text === 'a {"b":1}\n') && /nope is not defined \(main\.js line 2\)/.test(js[0].at(-1).error), 'JS console output and runtime error line: ' + JSON.stringify(js[0].at(-1)));
  ok(js[1].at(-1).ok === false && /SyntaxError/.test(js[1].at(-1).error), 'JS syntax error reported: ' + JSON.stringify(js[1].at(-1).error));
  const real = errors.filter((e) => !e.includes('missing is not defined')); // the preview's own intended error
  ok(real.length === 0, 'no page errors ' + JSON.stringify(real));
  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
