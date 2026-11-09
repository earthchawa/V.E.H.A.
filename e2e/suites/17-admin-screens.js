const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
(async () => {
  // a 2570/1 section of CS231 taught by T0001 → "upcoming"
  sql(`insert into "Term" (id,"academicYear",semester,"isCurrent","createdAt") values ('t2570', 2570, 1, false, now()) on conflict do nothing`);
  sql(`insert into "CourseOffering" (id,"courseId","termId",section,"createdAt") select 'o2570', id, 't2570', '1', now() from "Course" where code='CS231' on conflict do nothing`);
  sql(`insert into "Enrollment" (id,"userId","offeringId",role,"createdAt") select 'e2570', id, 'o2570', 'INSTRUCTOR', now() from "User" where username='T0001' on conflict do nothing`);
  const b = await chromium.launch();
  const login = async (u, np) => {
    const p = await (await b.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };
  const shot = (p, n, full = true) => p.screenshot({ path: `${S}/ux2-${n}.png`, fullPage: full });
  const lp = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await lp.goto(B + '/login');
  ok((await lp.locator('label[for=username]').textContent()).includes('Username or ID'), 'login label: Username or ID');
  ok(await lp.getByText('Online classroom for Air-cadets').count() === 1, 'tagline: for Air-cadets');
  await shot(lp, 'login', false);

  const ad = await login('admin', 'Strong9Pass');
  await ad.goto(B + '/admin/users?role=STUDENT');
  await ad.locator('[data-testid=user-row][data-username="6601002"]').getByTestId('manage-user').click();
  await ad.getByRole('dialog').getByLabel('Full name').fill('นนอ.ทดสอบ เลื่อนยศ');
  await ad.getByRole('dialog').getByLabel('Username or ID').fill('7999');
  await shot(ad, 'manage', false);
  await ad.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await ad.locator('dialog[open]').waitFor({ state: 'detached' }).catch(() => {});
  await ad.locator('[data-testid=user-row][data-username="7999"]').waitFor();
  ok(await ad.locator('dialog[open]').count() === 0, 'dialog closes after saving');
  ok(sql(`select "fullName" from "User" where username='7999'`) === 'นนอ.ทดสอบ เลื่อนยศ', 'admin edited username and name');
  ok(sql(`select details::text from "AuditLog" where action='user.updated'`).includes('"from": "6601002"'), 'edit audited with from/to');
  await ad.keyboard.press('Escape');
  await ad.locator('[data-testid=user-row][data-username="6601003"]').getByTestId('manage-user').click();
  await ad.getByRole('dialog').getByLabel('Username or ID').fill('7999');
  await ad.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await ad.getByRole('dialog').getByText('7999 is already used by another account.').waitFor();
  ok(true, 'duplicate username refused');
  await ad.keyboard.press('Escape');
  await ad.goto(B + '/admin/users'); await ad.getByPlaceholder('Search username or name').fill('ทดสอบ');
  await ad.waitForURL(/q=/); await ad.waitForLoadState('networkidle');
  ok(await ad.getByTestId('user-row').count() === 1, 'search filters as you type');
  await ad.goto(B + '/admin/users'); await shot(ad, 'users');
  await ad.goto(B + '/admin/courses'); await shot(ad, 'semesters');
  ok(await ad.getByTestId('semester-chips').getByText('Upcoming').count() === 1, 'upcoming semester marked');
  await ad.goto(B + '/admin/courses?view=catalog'); await shot(ad, 'catalog');

  // a brand-new student login after the username change
  const tp = await login('T0001', 'Teach3rPass');
  ok(await tp.getByTestId('upcoming-teaching').count() === 1, 'instructor sees next semester notice');
  await shot(tp, 'dash', false);
  await tp.getByTestId('upcoming-teaching').click(); await tp.waitForURL(/term=/);
  ok((await tp.locator('ul.grid a').allTextContents()).join(' ').includes('CS231'), 'can open next semester course to prepare');
  await tp.goto(B + '/');
  await tp.locator('ul.grid a', { hasText: 'CS201' }).first().click(); await tp.waitForURL(/courses\//);
  const c = tp.url();
  await tp.goto(c + '/grades'); await shot(tp, 'scores');
  await tp.getByTestId('tab-setup').click(); await tp.getByTestId('grade-setup').waitFor(); await shot(tp, 'setup');
  // a fresh section (Sec 2 has no setup) lands on setup with the template button
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
