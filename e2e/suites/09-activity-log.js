const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
(async () => {
  const browser = await chromium.launch();
  const ctx = () => browser.newContext({ viewport: { width: 1360, height: 900 } });
  const firstLogin = async (u, np) => {
    const p = await (await ctx()).newPage();
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };

  // ---- Logo: transparent, theme-specific variant, no white plate ----
  const lp = await (await ctx()).newPage();
  await lp.goto(B + '/login');
  const visibleVariant = () => lp.getByTestId('faculty-logo').locator('img').evaluateAll((imgs) => imgs.filter((i) => getComputedStyle(i).display !== 'none').map((i) => i.dataset.variant));
  ok(JSON.stringify(await visibleVariant()) === '["dark"]', 'dark theme shows the light-lettering logo only');
  const bg = await lp.getByTestId('faculty-logo').evaluate((e) => getComputedStyle(e).backgroundColor);
  ok(bg === 'rgba(0, 0, 0, 0)', 'no plate behind the logo (' + bg + ')');
  ok(await lp.getByTestId('faculty-logo').locator('img[data-variant=dark]').evaluate((i) => i.complete && i.naturalWidth > 0), 'dark logo loads');
  await lp.screenshot({ path: S + '/r7-login-dark.png' });
  await lp.getByTestId('theme-toggle').click();
  ok(JSON.stringify(await visibleVariant()) === '["light"]', 'light theme shows the original logo');
  await lp.screenshot({ path: S + '/r7-login-light.png' });

  // ---- Generate some activity ----
  const bad = await (await ctx()).newPage();
  await bad.goto(B + '/login'); await bad.fill('#username', '6601001'); await bad.fill('#password', 'wrong-pass-1');
  await bad.click('button[type=submit]'); await bad.locator('form [role=alert]').waitFor();
  const tp = await firstLogin('T0001', 'Teach3rPass');
  const ad = await firstLogin('admin', 'Strong9Pass');

  // ---- Activity page ----
  await ad.goto(B + '/admin/audit');
  const actions = () => ad.locator('[data-testid=audit-table] tbody tr[data-action]').evaluateAll((rs) => rs.map((r) => r.dataset.action));
  const all = await actions();
  ok(all.includes('login.failed') && all.includes('password.changed'), 'entries listed');
  ok(await ad.getByTestId('audit-day').count() >= 1, 'grouped under day headings');
  ok(await ad.locator('tr[data-action="login.failed"]').first().getByText('Sign-in failed').count() === 1, 'readable action labels');
  await ad.screenshot({ path: S + '/r7-audit.png', fullPage: true });

  await ad.getByTestId('audit-categories').locator('[data-cat=auth]').click();
  await ad.waitForURL(/cat=auth/);
  ok((await actions()).every((a) => /^(login|password|email)\./.test(a)), 'category filter: sign-in & passwords only');

  await ad.getByLabel(/Problems only/).check();
  await ad.getByRole('button', { name: 'Filter' }).click();
  await ad.waitForURL(/problems=1/);
  const probs = await actions();
  ok(probs.length >= 1 && probs.every((a) => /failed|locked/.test(a)), 'problems-only filter');

  await ad.goto(B + '/admin/audit');
  const csId = await ad.locator('#audit-dept option', { hasText: 'CS — Computer Science' }).getAttribute('value');
  await ad.selectOption('#audit-dept', csId);
  await ad.getByRole('button', { name: 'Filter' }).click();
  await ad.waitForURL(/dept=/);
  const users = await ad.locator('[data-testid=audit-table] tbody tr[data-action] td:nth-child(3)').allTextContents();
  ok(users.length > 0 && users.some((u) => u.includes('T0001')) && !users.some((u) => u.includes('admin')), 'department filter: CS users only, not admin');

  await ad.goto(B + '/admin/audit');
  await ad.getByRole('link', { name: 'Today' }).click();
  await ad.waitForURL(/from=/);
  ok((await actions()).length === all.length, 'Today range keeps today\'s entries');
  await ad.goto(B + '/admin/audit?from=2020-01-01&to=2020-01-02');
  ok(await ad.getByText('No activity matches these filters.').count() === 1, 'empty range shows empty state');

  const r = await ad.context().request.get(B + '/api/admin/audit?cat=auth');
  const body = await r.text();
  ok(r.status() === 200 && body.startsWith('﻿') && body.includes('login.failed') && !body.includes('quiz.'), 'CSV export follows filters');
  const tr = await tp.context().request.get(B + '/api/admin/audit');
  ok(tr.status() === 404, 'CSV export is admin-only');
  await ad.goto(B + '/admin/audit?cat=settings');
  ok((await actions()).includes('audit.exported'), 'export itself is logged');

  // Thai labels
  await ad.context().addCookies([{ name: 'lang', value: 'th', url: B }]);
  await ad.goto(B + '/admin/audit');
  ok(await ad.getByText('เข้าสู่ระบบไม่สำเร็จ').count() >= 1, 'Thai action labels');
  await ad.screenshot({ path: S + '/r7-audit-th.png', fullPage: true });
  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
