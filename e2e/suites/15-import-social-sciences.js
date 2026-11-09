const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = async () => { const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  const ad = await ctx();
  await ad.goto(B + '/login'); await ad.fill('#username', 'admin'); await ad.fill('#password', PW.admin);
  await ad.click('button[type=submit]'); await ad.waitForURL(/change-password/);
  await ad.fill('#currentPassword', PW.admin); await ad.fill('#newPassword', 'Strong9Pass'); await ad.fill('#confirmPassword', 'Strong9Pass');
  await ad.click('button[type=submit]'); await ad.waitForURL(B + '/');
  const importUsers = async (file) => {
    await ad.goto(B + '/admin/users'); await ad.getByTestId('import-users').click();
    await ad.locator('#csv-file').setInputFiles(file);
    await ad.getByRole('dialog').getByRole('button', { name: /Import/ }).last().click();
    await ad.getByRole('dialog').getByText(/Temporary passwords|รหัสผ่านชั่วคราว/).waitFor({ timeout: 90000 });
    await ad.keyboard.press('Escape');
  };
  await importUsers(F + '/hs-instructor.csv');                      // the user already did this on the live system
  await importUsers(F + '/cadets-cs-y2-4.csv');           // already imported earlier on the live system
  await importUsers(F + '/cadets-y4-other-majors.csv');   // new
  ok(sql(`select count(*) from "User" u join "Department" d on d.id=u."departmentId" where u.role='STUDENT' and d.code in ('AE','ME','EE','CE','IEA','MS')`) === '103', '103 year-4 cadets of the other majors, each in their department');

  await ad.goto(B + '/admin/courses'); await ad.getByTestId('import-schedule').click();
  await ad.locator('#sched-file').setInputFiles(F + '/schedule-ss5.csv');
  await ad.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  const msg = await ad.getByText(/Imported 2 rows/).textContent({ timeout: 60000 });
  ok(/1 new course\(s\), 2 new section\(s\), 2 instructor enrolment\(s\), 125 cadet enrolment\(s\)/.test(msg), msg);
  ok(sql(`select d.code from "Course" c join "Department" d on d.id=c."departmentId" where c.code='SS402'`) === 'HS', 'SS402 filed under Humanities & Social Sciences');
  const per = sql(`select o.section||':'||count(*) from "Enrollment" e join "CourseOffering" o on o."id"=e."offeringId" join "Course" c on c.id=o."courseId" where c.code='SS402' and e.role='STUDENT' group by o.section order by 1`);
  ok(per === '1:63\n2:62', 'section sizes: ' + per.replace('\n', ' '));
  await ad.keyboard.press('Escape');
  await ad.reload(); await ad.screenshot({ path: S + '/r13-semester.png', fullPage: true });

  // fix the placeholder code with the new Edit button
  await ad.goto(B + '/admin/courses?view=catalog');
  await ad.locator('li', { hasText: 'SS402' }).getByTestId('edit-course').click();
  await ad.getByRole('dialog').getByLabel('Code').fill('SS501');
  await ad.getByRole('dialog').getByLabel('Credits').fill('2');
  await ad.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await ad.locator('dialog[open]').waitFor({ state: 'detached' }).catch(() => {});
  await ad.locator('li', { hasText: 'SS501' }).first().waitFor();
  ok(sql(`select credits from "Course" where code='SS501'`) === '2', 'course code and credits edited');
  ok(sql(`select details::text from "AuditLog" where action='course.updated'`).includes('SS402'), 'course edit audited');

  // the instructor sees both sections
  const an = await ctx();
  await an.goto(B + '/login'); await an.fill('#username', 'hs_teacher'); await an.fill('#password', 'fixture-pass-1');
  await an.click('button[type=submit]'); await an.waitForURL(/change-password/);
  await an.fill('#currentPassword', 'fixture-pass-1'); await an.fill('#newPassword', 'Anchasa2569x'); await an.fill('#confirmPassword', 'Anchasa2569x');
  await an.click('button[type=submit]'); await an.waitForURL(B + '/');
  const cards = await an.locator('ul.grid a').allTextContents();
  ok(cards.filter((c) => c.includes('SS501')).length === 2, 'hs_teacher sees sections 1 and 2');
  await an.screenshot({ path: S + '/r13-instructor.png', fullPage: true });
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
