const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
(async () => {
  const b = await chromium.launch();
  const login = async (u, np, w = 1366) => {
    const p = await (await b.newContext({ viewport: { width: w, height: 860 }, deviceScaleFactor: 2 })).newPage();
    await p.context().addCookies([{ name: 'lang', value: 'th', url: B }]);
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };
  const tp = await login('T0001', 'Teach3rPass');
  ok(await tp.locator('header a[href="/account"] span.truncate').isVisible(), 'instructor name visible in the header at 1366px');
  await tp.locator('ul.grid a', { hasText: 'CS201' }).first().click(); await tp.waitForURL(/courses\/[^/]+$/);
  const course = tp.url();
  const tabs = tp.locator('nav.border-b').first();
  ok(await tabs.evaluate((n) => n.scrollHeight <= n.clientHeight + 1 && getComputedStyle(n).overflowX !== 'auto'), 'course tabs have no scroll bar');
  const lines = await tp.getByTestId('course-dept').locator(':scope > div').evaluateAll((ds) => ds.map((d) => Math.round(d.getBoundingClientRect().height)));
  ok(lines.length === 2 && lines.every((h) => h <= 20), 'subject area and department each on one line: ' + JSON.stringify(lines));
  await tp.screenshot({ path: S + '/ux4-course.png', clip: { x: 0, y: 0, width: 1366, height: 420 } });
  // quiz form: field tops line up
  await tp.goto(course + '/quizzes');
  await tp.getByTestId('new-quiz').or(tp.getByRole('button', { name: /แบบทดสอบใหม่|New quiz/ })).first().click();
  const [lim, cat] = await Promise.all([tp.locator('#qz-limit').boundingBox(), tp.locator('dialog[open] select[name=categoryId]').boundingBox()]);
  ok(Math.abs(lim.y - cat.y) <= 1 && Math.abs(lim.height - cat.height) <= 1, `time limit and category fields line up (${lim.y}/${cat.y}, ${lim.height}/${cat.height})`);
  await tp.locator('dialog[open]').screenshot({ path: S + '/ux4-quizform.png' });
  await tp.keyboard.press('Escape');

  const ad = await login('admin', 'Strong9Pass', 1366);
  await ad.goto(B + '/admin/audit');
  const hs = await ad.locator('[data-testid=audit-table] tbody tr[data-action] td:nth-child(2) > span').evaluateAll((xs) => xs.map((x) => Math.round(x.getBoundingClientRect().height)));
  ok(hs.length > 0 && hs.every((h) => h <= 22), 'each action label on a single line');
  await ad.screenshot({ path: S + '/ux4-audit.png', clip: { x: 0, y: 0, width: 1366, height: 860 } });
  const hdr = await ad.locator('header').boundingBox();
  ok(hdr.height <= 60, 'admin header stays one row at 1366px: ' + hdr.height);
  await ad.goto(B + '/admin/courses');
  await ad.screenshot({ path: S + '/ux4-semesters.png', clip: { x: 0, y: 0, width: 1366, height: 600 } });
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
