const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const firstLogin = async (u, np, vp = { width: 1360, height: 900 }) => {
    const p = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errors.push(u + ': ' + e.message));
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };

  // ---------- Sign-in tagline ----------
  const lp = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await lp.context().addCookies([{ name: 'lang', value: 'th', url: B }]);
  await lp.goto(B + '/login');
  ok(await lp.getByText('ระบบการเรียนออนไลน์ของ นนอ.', { exact: true }).count() === 1, 'Thai tagline: ระบบการเรียนออนไลน์ของ นนอ.');

  // ---------- Header lockup ----------
  const tp = await firstLogin('T0001', 'Teach3rPass');
  const logo = tp.getByTestId('app-logo');
  ok(await logo.locator('img').evaluate((i) => i.src.endsWith('/logos/af-mark.webp') && i.naturalWidth > 0), 'header uses the AF emblem');
  ok((await logo.textContent()).includes('V.E.H.A.') && (await logo.textContent()).includes('Virtual Educational Hangar for Air-cadets'), 'name + full name in header');
  const [ib, tb] = await Promise.all([logo.locator('img').boundingBox(), logo.locator('span').first().boundingBox()]);
  ok(Math.abs((ib.y + ib.height / 2) - (tb.y + tb.height / 2)) <= 2, 'emblem and text vertically centred');
  await tp.screenshot({ path: S + '/r10-header.png', clip: { x: 0, y: 0, width: 760, height: 64 } });
  ok(await tp.getByTestId('back-button').count() === 0, 'no Back on the dashboard');

  // ---------- Back button: follows history ----------
  await tp.locator('ul.grid a', { hasText: 'CS201' }).filter({ hasNotText: 'Sec 2' }).first().click(); await tp.waitForURL(/courses\/[^/]+$/);
  const course = tp.url();
  await tp.getByRole('link', { name: 'Assignments' }).first().click(); await tp.waitForURL(/assignments$/);
  await tp.getByText('Lab 3: Linked list (Python)').click(); await tp.waitForURL(/assignments\/[^/]+$/);
  const lab3 = tp.url();
  await tp.locator('tr', { hasText: '6601001' }).getByRole('link', { name: 'Report' }).click(); await tp.waitForURL(/report\//);
  const report = tp.url();
  await tp.getByTestId('back-button').click(); await tp.waitForURL(lab3);
  ok(true, 'Back: report → assignment');
  await tp.getByTestId('back-button').click(); await tp.waitForURL(course + '/assignments');
  ok(await tp.getByTestId('back-button').count() === 0, 'course tab pages have no Back (the tabs do that job)');
  ok(true, 'Back walks the history: report → assignment → assignments');

  // ---------- Back button: page opened directly goes to its parent ----------
  const fresh = await tp.context().newPage();
  await fresh.goto(report);
  await fresh.getByTestId('back-button').click(); await fresh.waitForURL(lab3);
  ok(true, 'opened directly: report → its assignment');
  await fresh.goto(course + '/quizzes');
  await fresh.getByText('Quiz 1: Linked lists').click(); await fresh.waitForURL(/quizzes\/[^/]+$/);
  await fresh.getByRole('link', { name: 'Results' }).click(); await fresh.waitForURL(/results$/);
  const res = fresh.url();
  await fresh.goto(res); // reload: history inside the app is gone
  await fresh.getByTestId('back-button').click(); await fresh.waitForURL(/quizzes\/[^/]+$/);
  ok(true, 'after a reload: results → quiz');

  // ---------- Curriculum courses ----------
  const ad = await firstLogin('admin', 'Strong9Pass');
  await ad.goto(B + '/admin/courses?view=catalog');
  const cat = ad.getByTestId('course-catalog');
  for (const [code, title] of [['CS101', 'Information Technology'], ['CS231', 'Data Structures and Algorithms'], ['CS530', 'Research Project'], ['MA111', 'Calculus 1'], ['MA431', 'Quantitative Research']])
    ok(await cat.locator('li', { hasText: code }).filter({ hasText: title }).count() === 1, `course ${code} ${title}`);
  ok(await cat.locator('li', { hasText: 'CS436' }).locator('select').inputValue() !== '', 'curriculum course linked to a subject area');
  ok(await ad.getByTestId('back-button').count() === 0, 'no Back on pages reached from the top menu');
  await ad.goto(B + '/admin/courses');
  await ad.getByTestId('offering-row').first().getByRole('link', { name: 'Manage roster' }).click();
  await ad.waitForURL(/admin\/offerings\//);
  ok(await ad.getByTestId('back-button').count() === 1, 'Back on nested admin pages');
  await ad.goto(B + '/admin/departments');
  ok(await ad.getByTestId('division').count() === 9, '9 departments (CS under MC)');
  ok(await ad.getByTestId('division').filter({ hasText: 'Department of Mathematics and Computer Science' }).locator('li', { hasText: 'Computer Science' }).count() === 1, 'CS listed under MC');

  // ---------- Mobile header ----------
  const mp = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
  await mp.context().addCookies(await tp.context().cookies());
  await mp.goto(lab3);
  ok(await mp.getByTestId('back-button').isVisible(), 'Back on phone');
  ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no horizontal scroll on phone');
  await mp.screenshot({ path: S + '/r10-mobile.png' });
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
