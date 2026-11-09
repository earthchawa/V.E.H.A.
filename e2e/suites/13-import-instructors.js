const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = async () => { const p = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  const ad = await ctx();
  await ad.goto(B + '/login'); await ad.fill('#username', 'admin'); await ad.fill('#password', PW.admin);
  await ad.click('button[type=submit]'); await ad.waitForURL(/change-password/);
  await ad.fill('#currentPassword', PW.admin); await ad.fill('#newPassword', 'Strong9Pass'); await ad.fill('#confirmPassword', 'Strong9Pass');
  await ad.click('button[type=submit]'); await ad.waitForURL(B + '/');

  // Schedule before the accounts exist → clear error, nothing created
  await ad.goto(B + '/admin/courses');
  await ad.getByTestId('import-schedule').click();
  await ad.locator('#sched-file').setInputFiles(F + '/schedule-instructors-only.csv');
  await ad.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await ad.getByText(/No account yet for: teacher01/).waitFor();
  ok(sql(`select count(*) from "Course" where code='CS268'`) === '0', 'schedule refused until instructors exist');
  await ad.keyboard.press('Escape');

  // 1. Instructors (Excel-style CSV with BOM, starting password fixture-pass-1)
  await ad.goto(B + '/admin/users');
  await ad.getByRole('button', { name: 'Import from CSV' }).click();
  await ad.locator('#csv-file').setInputFiles(F + '/instructors.csv');
  await ad.getByRole('dialog').getByRole('button', { name: /Import/ }).last().click();
  await ad.getByText('fixture-pass-1').first().waitFor();
  ok(sql(`select count(*) from "User" u join "Department" d on d.id=u."departmentId" where u.role='INSTRUCTOR' and d.code='CS' and u.username like '%\\_%' and u."mustChangePassword"`) === '15', '15 instructors created in CS, must change password');
  await ad.keyboard.press('Escape');

  // 2. Teaching schedule
  await ad.goto(B + '/admin/courses');
  await ad.getByTestId('import-schedule').click();
  await ad.locator('#sched-file').setInputFiles(F + '/schedule-instructors-only.csv');
  await ad.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  const okMsg = ad.getByText(/Imported 20 rows/);
  await okMsg.waitFor();
  const text = await okMsg.textContent();
  ok(/8 new course\(s\), 20 new section\(s\), 26 instructor enrolment\(s\)/.test(text), 'schedule imported: ' + text);
  ok(sql(`select d.code from "Course" c join "Department" d on d.id=c."departmentId" where c.code='CS268'`) === 'CS', 'new elective linked to CS');
  ok(sql(`select count(*) from "Enrollment" e join "CourseOffering" o on o.id=e."offeringId" join "Course" c on c.id=o."courseId" join "Term" t on t.id=o."termId" where c.code='CS132' and t."academicYear"=2569 and t.semester=2 and e.role='INSTRUCTOR'`) === '4', 'CS132 has its 4 instructors');
  await ad.screenshot({ path: S + '/r11-courses.png', fullPage: true });

  // 3. Importing the same file again changes nothing
  await ad.locator('#sched-file').setInputFiles(F + '/schedule-instructors-only.csv');
  await ad.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await ad.getByText(/0 new semester\(s\), 0 new course\(s\), 0 new section\(s\), 0 instructor/).waitFor();
  ok(true, 're-import is a no-op');
  ok(Number(sql(`select count(*) from "AuditLog" where action='offering.imported'`)) === 2, 'imports audited');

  // 4. An instructor signs in with the starting password and must change it
  const th = await ctx();
  await th.goto(B + '/login'); await th.fill('#username', 'teacher05'); await th.fill('#password', 'fixture-pass-1');
  await th.click('button[type=submit]'); await th.waitForURL(/change-password/);
  ok(true, 'teacher05 signs in with fixture-pass-1 and is sent to change it');
  await th.fill('#currentPassword', 'fixture-pass-1'); await th.fill('#newPassword', 'Thewa2569pass'); await th.fill('#confirmPassword', 'Thewa2569pass');
  await th.click('button[type=submit]'); await th.waitForURL(B + '/');
  const cards = await th.locator('ul.grid a').allTextContents();
  ok(cards.some((c) => c.includes('CS132')), 'current term (2/2569): instructor sees CS132');
  await th.screenshot({ path: S + '/r11-instructor.png', fullPage: true });
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
