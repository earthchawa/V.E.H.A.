const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const login = async (u, np, vp = { width: 1360, height: 900 }) => {
    const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.context().addCookies([{ name: 'lang', value: 'th', url: B }, { name: 'theme', value: 'light', url: B }]);
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };
  // login: hint moved into ⓘ
  const lp = await (await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 })).newPage();
  await lp.goto(B + '/login');
  ok(await lp.getByText('Cadets: your cadet number · Staff: your username').isVisible() === false, 'login hint hidden until hovered');
  await lp.locator('label[for=username]').getByTestId('info-tip').hover();
  ok(await lp.getByRole('tooltip').filter({ hasText: 'Cadets: your cadet number' }).isVisible(), 'hover shows the hint');
  await lp.screenshot({ path: S + '/ux3-login.png' });

  const tp = await login('T0001', 'Teach3rPass');
  await tp.locator('ul.grid a', { hasText: 'CS201' }).first().click(); await tp.waitForURL(/courses\/[^/]+$/);
  const course = tp.url();
  ok(await tp.getByTestId('back-button').count() === 0, 'no Back on the course tab pages');
  await tp.goto(course + '/assignments');
  await tp.getByText('Essay: Arrays vs. linked lists').click(); await tp.waitForURL(/assignments\/[^/]+$/);
  const asg = tp.url();
  await tp.screenshot({ path: S + '/ux3-assignment.png' });
  await tp.locator('tr', { hasText: '6601005' }).getByRole('link', { name: 'รายงาน' }).click(); await tp.waitForURL(/report\//);
  const back = tp.getByTestId('back-button');
  ok((await back.textContent()).includes('กลับไปที่งาน'), 'Back says where it goes: ' + await back.textContent());
  const [tabs, bb] = await Promise.all([tp.locator('nav.border-b').first().boundingBox(), back.boundingBox()]);
  ok(bb.y > tabs.y, 'Back sits under the course tabs');
  await tp.screenshot({ path: S + '/ux3-report.png' });
  await back.click(); await tp.waitForURL(asg);
  ok(true, 'Back returns to the assignment');
  // phone
  const mp = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await mp.context().addCookies(await tp.context().cookies());
  await mp.goto(asg);
  ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'assignment page fits a phone');
  await mp.getByTestId('info-tip').first().tap();
  ok(await mp.getByRole('tooltip').first().isVisible(), 'tap shows a hint on phones');
  ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'open hint does not widen the page');
  await mp.screenshot({ path: S + '/ux3-mobile.png' });
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
