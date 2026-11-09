const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
const handout = fs.readFileSync(F + '/cadets-cs-y2-4-handout.csv', 'utf8').replace(/^﻿/, '').trim().split('\n').slice(1).map((l) => l.split(','));
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = async () => { const p = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  const ad = await ctx();
  await ad.goto(B + '/login'); await ad.fill('#username', 'admin'); await ad.fill('#password', PW.admin);
  await ad.click('button[type=submit]'); await ad.waitForURL(/change-password/);
  await ad.fill('#currentPassword', PW.admin); await ad.fill('#newPassword', 'Strong9Pass'); await ad.fill('#confirmPassword', 'Strong9Pass');
  await ad.click('button[type=submit]'); await ad.waitForURL(B + '/');
  const importUsers = async (file) => {
    await ad.goto(B + '/admin/users');
    await ad.getByTestId('import-users').click();
    await ad.locator('#csv-file').setInputFiles(file);
    await ad.getByRole('dialog').getByRole('button', { name: /Import/ }).last().click();
    await ad.locator('dialog[open]').getByText(/Created|created|สร้าง/).first().waitFor({ timeout: 60000 }).catch(() => {});
    await ad.waitForLoadState('networkidle');
    await ad.keyboard.press('Escape');
  };
  const importSchedule = async (file) => {
    await ad.goto(B + '/admin/courses');
    await ad.getByTestId('import-schedule').click();
    await ad.locator('#sched-file').setInputFiles(file);
    await ad.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    const m = ad.getByText(/Imported \d+ rows/);
    await m.waitFor({ timeout: 60000 });
    const text = await m.textContent();
    await ad.keyboard.press('Escape');
    return text;
  };

  // Earlier state: instructors + the first schedule (no cadets) already imported
  await importUsers(F + '/instructors.csv');
  await importSchedule(F + '/schedule-instructors-only.csv');

  // Now: cadets, then the schedule again with the cadets column
  await importUsers(F + '/cadets-cs-y2-4.csv');
  ok(sql(`select count(*) from "User" u join "Department" d on d.id=u."departmentId" where u.role='STUDENT' and d.code='CS' and u.username ~ '^[0-9]{4}$'`) === '62', '62 cadets created in CS');
  const msg = await importSchedule(F + '/schedule-with-cadets.csv');
  ok(/0 new section\(s\), 0 instructor enrolment\(s\), 304 cadet enrolment\(s\)/.test(msg), 'only the cadets are added: ' + msg);
  const per = sql(`select c.code||':'||count(*) from "Enrollment" e join "CourseOffering" o on o.id=e."offeringId" join "Course" c on c.id=o."courseId" join "Term" t on t.id=o."termId" where t."academicYear"=2569 and e.role='STUDENT' group by c.code order by c.code`).split('\n');
  ok(per.includes('CS231:24') && per.includes('CS331:16') && per.includes('CS431:22') && !per.some((x) => x.startsWith('CS271')), 'class sizes per course: ' + per.join(' '));

  // A year-2 cadet signs in with the starting password from the handout
  const [, user, , pw] = handout.find((r) => r[0] === '2');
  ok(/^\d{4}$/.test(user), 'username is the cadet number: ' + user);
  const c = await ctx();
  await c.goto(B + '/login'); await c.fill('#username', user); await c.fill('#password', pw);
  await c.click('button[type=submit]'); await c.waitForURL(/change-password/);
  await c.fill('#currentPassword', pw); await c.fill('#newPassword', 'Cadet2569pass'); await c.fill('#confirmPassword', 'Cadet2569pass');
  await c.click('button[type=submit]'); await c.waitForURL(B + '/');
  const cards = (await c.locator('ul.grid a').allTextContents()).join(' ');
  ok(['CS233', 'CS236', 'CS269'].every((x) => cards.includes(x)) && !cards.includes('CS332'), `${user} (year 2) sees their semester-2 courses`);
  await c.screenshot({ path: S + '/r12-cadet.png', fullPage: true });
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
