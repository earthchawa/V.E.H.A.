const { chromium, devices } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const VP = { width: Number(process.env.W || 390), height: 844 };
const SHOTS = process.env.SHOTS === '1';
(async () => {
  const browser = await chromium.launch();
  const report = [];
  const ctxFor = () => browser.newContext({ viewport: VP, deviceScaleFactor: SHOTS ? 2 : 1, isMobile: true, hasTouch: true });
  const firstLogin = async (u, np) => {
    const p = await (await ctxFor()).newPage();
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await check(p, 'change-password');
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };
  async function check(p, name) {
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(300);
    const r = await p.evaluate((vw) => {
      const doc = document.documentElement;
      const offenders = [];
      const scrollable = (el) => {
        for (let e = el.parentElement; e; e = e.parentElement) {
          const s = getComputedStyle(e);
          if ((s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') && e !== document.body && e !== doc) return true;
        }
        return false;
      };
      for (const el of document.body.querySelectorAll('*')) {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        const s = getComputedStyle(el);
        if (s.position === 'fixed' && el.closest('[data-testid=login-scene]')) continue;
        if (b.right > vw + 1 || b.left < -1) {
          if (scrollable(el)) continue;
          offenders.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).slice(0, 60)} [${Math.round(b.left)}→${Math.round(b.right)}] "${(el.textContent || '').trim().slice(0, 40)}"`);
        }
      }
      // keep only outermost offenders
      return { sw: doc.scrollWidth, offenders: offenders.slice(0, 8) };
    }, VP.width);
    const bad = r.sw > VP.width + 1 || r.offenders.length;
    report.push(`${bad ? 'XX' : 'ok'} ${name} scrollWidth=${r.sw}${r.offenders.length ? '\n     ' + r.offenders.join('\n     ') : ''}`);
    if (SHOTS || bad) await p.screenshot({ path: `${S}/mobile/${name.replace(/[^\w-]+/g, '_')}.png`, fullPage: true });
  }
  const lp = await (await ctxFor()).newPage();
  await lp.goto(B + '/login'); await check(lp, 'login');
  await lp.goto(B + '/forgot-password'); await check(lp, 'forgot-password');

  const tp = await firstLogin('T0001', 'Teach3rPass');
  await check(tp, 't-dashboard');
  await tp.locator('ul.grid a', { hasText: 'CS201' }).first().click(); await tp.waitForURL(/courses\/[^/]+$/);
  const course = tp.url();
  await check(tp, 't-materials');
  await tp.goto(course + '/assignments'); await check(tp, 't-assignments');
  const asg = tp.locator('a[href*="/assignments/"]').first();
  if (await asg.count()) { await asg.click(); await tp.waitForLoadState(); await check(tp, 't-assignment-detail');
    const rep = tp.locator('a[href*="/report"], a[href*="/submissions/"]').first();
    if (await rep.count()) { await rep.click(); await tp.waitForLoadState(); await check(tp, 't-submission'); } }
  await tp.goto(course + '/grades'); await check(tp, 't-grades');
  await tp.goto(course + '/quizzes'); await check(tp, 't-quizzes');
  await tp.getByText('Quiz 1: Linked lists').click(); await tp.waitForURL(/quizzes\/[^/]+$/); await check(tp, 't-quiz-detail');
  const quiz = tp.url();
  await tp.goto(quiz + '/results'); await check(tp, 't-quiz-results');
  // open modals
  await tp.goto(course + '/assignments');
  const newA = tp.getByRole('button', { name: /New assignment/ }).first();
  if (await newA.count()) { await newA.click(); await check(tp, 't-modal-new-assignment'); }

  const c1 = await firstLogin('6601001', 'Cadet1Pass');
  await check(c1, 'c-dashboard');
  await c1.goto(course); await check(c1, 'c-materials');
  await c1.goto(course + '/assignments'); await check(c1, 'c-assignments');
  await c1.goto(course + '/grades'); await check(c1, 'c-grades');
  await c1.goto(course + '/quizzes'); await check(c1, 'c-quizzes');
  await c1.getByText('Quiz 2: Coding practice').click(); await c1.waitForURL(/quizzes\/[^/]+$/); await check(c1, 'c-quiz-start');
  await c1.getByRole('button', { name: 'Start quiz' }).click(); await c1.waitForURL(/\/exam\//);
  await c1.getByTestId('fullscreen-overlay').getByRole('button').click().catch(() => {});
  await check(c1, 'c-exam-code');

  const ad = await firstLogin('admin', 'Strong9Pass');
  await check(ad, 'a-dashboard');
  for (const path of ['/admin/users', '/admin/courses', '/admin/departments', '/admin/exam-settings', '/admin/audit']) {
    await ad.goto(B + path); await check(ad, 'a-' + path.split('/').pop());
  }
  await ad.goto(B + '/admin/courses');
  const off = ad.locator('a[href*="/admin/offerings/"]').first();
  if (await off.count()) { await off.click(); await ad.waitForLoadState(); await check(ad, 'a-offering'); }
  await ad.goto(course + '/grades'); await check(ad, 'a-grades');
  console.log(report.join('\n'));
  await browser.close();
  if (report.some((l) => l.startsWith('XX'))) throw new Error('FAIL: horizontal overflow at ' + VP.width + 'px');
  console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
