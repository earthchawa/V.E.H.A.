const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };

(async () => {
  const browser = await chromium.launch();
  const firstLogin = async (u, np) => {
    const p = await (await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };
  const card = (p, code, notSec2 = true) => p.locator('ul.grid a', { hasText: code }).filter(notSec2 ? { hasNotText: 'Sec 2' } : {});

  // ---------- Instructor dashboard ----------
  const tp = await firstLogin('T0001', 'Teach3rPass');
  const groups = await tp.getByTestId('course-group').locator('h2').allTextContents();
  ok(groups.includes('Computer Science') && groups.includes('Mathematics'), 'courses grouped by department / subject area');
  ok(await tp.getByTestId('instructor-todo').count() === 1, 'to-do panel shown');
  const ccOf = (el) => el.evaluate((e) => getComputedStyle(e).getPropertyValue('--cc').trim());
  ok((await ccOf(card(tp, 'CS201'))) === (await ccOf(card(tp, 'MA101'))), 'subject areas share their department colour');
  await tp.screenshot({ path: S + '/r6-dashboard.png', fullPage: true });

  // Drag-and-drop a file into the material dropzone
  await card(tp, 'CS201').click(); await tp.waitForURL(/courses\/[^/]+$/);
  await tp.getByTestId('add-material').click();
  await tp.fill('#title', 'Dropped notes');
  const dt = await tp.evaluateHandle(() => { const d = new DataTransfer(); d.items.add(new File(['dropped-bytes'], 'notes.txt', { type: 'text/plain' })); return d; });
  await tp.getByTestId('dropzone').dispatchEvent('drop', { dataTransfer: dt });
  ok(await tp.getByRole('dialog').getByText('notes.txt').count() === 1, 'dropped file listed in the modal');
  await tp.screenshot({ path: S + '/r6-modal-material.png' });
  await tp.getByRole('dialog').getByRole('button', { name: 'Add material' }).click();
  await tp.locator('dialog[open]').waitFor({ state: 'hidden' });
  const href = await tp.getByText('Dropped notes').getAttribute('href');
  ok((await (await tp.context().request.get(B + href)).text()) === 'dropped-bytes', 'dropped file uploaded');

  // ---------- Admin ----------
  const ad = await firstLogin('admin', 'Strong9Pass');
  // Gradebook is read-only for admins
  await card(ad, 'CS201').click(); await ad.waitForURL(/courses\/[^/]+$/);
  const course = ad.url();
  await ad.goto(course + '/grades');
  ok(await ad.getByTestId('grades-readonly').count() === 1, 'admin sees read-only notice');
  ok(await ad.locator('[data-testid=gradebook] input:not([disabled])').count() === 0, 'admin cannot edit scores');
  ok(await ad.getByRole('button', { name: 'Save grades' }).count() === 0 && await ad.locator('summary', { hasText: /^Setup/ }).count() === 0, 'no save or setup for admin');
  ok((await ad.context().request.get(course.replace('/courses/', '/api/offerings/') + '/grades')).status() === 200, 'admin can still export');
  await ad.goto(course + '/assignments');
  await ad.getByText('Lab 3: Linked list (Python)').click(); await ad.waitForURL(/assignments\/[^/]+$/);
  await ad.locator('tr', { hasText: '6601001' }).getByRole('link', { name: 'Report' }).click(); await ad.waitForURL(/report/);
  ok(await ad.locator('#g-points').count() === 0, 'no grading panel for admin on reports');
  // Instructor still can
  await tp.goto(ad.url());
  ok(await tp.locator('#g-points').count() === 1, 'instructor keeps the grading panel');

  // Departments
  await ad.goto(B + '/admin/departments');
  ok(await ad.getByTestId('division').count() === 9, 'academy departments listed');
  await ad.getByTestId('add-department').click();
  await ad.fill('#dep-code', 'ft');
  await ad.fill('#dep-name', 'Division of Flight Training');
  await ad.fill('#dep-nameTh', 'กองวิชาการบิน');
  await ad.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await ad.locator('dialog[open]').waitFor({ state: 'hidden' });
  ok(await ad.getByTestId('division').count() === 10, 'department added from modal (code upper-cased)');
  ok(await ad.getByText('FT', { exact: true }).count() >= 1 && await ad.getByText('ft', { exact: true }).count() === 0, 'code shown upper-cased as FT');
  await ad.getByTestId('add-department').click();
  await ad.fill('#dep-code', 'CS');
  await ad.fill('#dep-name', 'Duplicate');
  await ad.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await ad.getByText('That code already exists.').waitFor();
  ok(true, 'duplicate code rejected');
  await ad.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await ad.screenshot({ path: S + '/r6-departments.png', fullPage: true });

  // Move CS202 to Mathematics from the course catalogue
  await ad.goto(B + '/admin/courses?view=catalog');
  await ad.getByLabel('Department / subject area CS202').selectOption({ label: '— MA Mathematics' });
  await ad.waitForTimeout(1200);
  await tp.goto(B + '/');
  const mathGroup = tp.getByTestId('course-group').filter({ has: tp.locator('h2', { hasText: /^Mathematics$/ }) });
  ok(await mathGroup.getByText('CS202').count() >= 1, 'course moved to another department');

  // Exam settings
  await ad.goto(B + '/admin/exam-settings');
  ok(await ad.getByTestId('room').count() === 1, 'seeded exam room listed');
  await ad.getByTestId('add-room').click();
  await ad.fill('#room-name', 'Library');
  await ad.fill('#room-cidrs', '10.30.0.0/33');
  await ad.getByRole('dialog').getByRole('button', { name: 'Add room' }).click();
  await ad.getByText('Invalid address: 10.30.0.0/33').waitFor();
  await ad.fill('#room-cidrs', '10.30.0.0/16');
  await ad.getByRole('dialog').getByRole('button', { name: 'Add room' }).click();
  await ad.locator('dialog[open]').waitFor({ state: 'hidden' });
  ok(await ad.getByTestId('room').count() === 2, 'room added; invalid CIDR rejected first');
  ok(await ad.locator('#seb-keys').count() === 0 && await ad.getByTestId('exam-mode-note').count() === 1, 'SEB keys hidden while SEB is switched off');
  await ad.screenshot({ path: S + '/r6-exam-settings.png', fullPage: true });

  // Users: create with department; filter
  await ad.goto(B + '/admin/users');
  await ad.getByTestId('new-user').click();
  await ad.fill('#cu-username', '6701001');
  await ad.fill('#cu-fullName', 'นนอ.ใหม่ คณิต');
  await ad.selectOption('#cu-dept', 'MA');
  await ad.getByRole('dialog').getByRole('button', { name: 'Create account' }).click();
  await ad.getByRole('dialog').getByText('Temporary passwords').waitFor();
  ok(true, 'user created in modal; temp password shown (modal stays open)');
  await ad.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await ad.reload();
  await ad.selectOption('select[name=dept]', { label: '— MA Mathematics' });
  await ad.waitForURL(/dept=/);
  await ad.waitForLoadState('networkidle');
  const rows = ad.getByTestId('user-row');
  ok(await rows.count() === 1 && (await rows.first().textContent()).includes('6701001'), 'filter users by department');

  // Instructor sees the plain-language exam options with rooms from admin
  await tp.goto(course.replace(/\/courses\/.*/, '') + course.slice(course.indexOf('/courses/')) + '/quizzes');
  await tp.getByText('Quiz 1: Linked lists').click(); await tp.waitForURL(/quizzes\/[^/]+$/);
  await tp.getByTestId('quiz-more').click(); await tp.getByTestId('quiz-settings').click();
  await tp.getByLabel('Only in these exam rooms').check();
  ok(await tp.getByLabel('Library').count() === 1 && await tp.getByLabel('CS Lab 301').count() === 1, 'instructor picks rooms by name');
  await tp.screenshot({ path: S + '/r6-quiz-settings.png', fullPage: true });

  // Thai labels
  await tp.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await tp.getByRole('button', { name: 'TH' }).click();
  await tp.getByRole('link', { name: 'แบบทดสอบ' }).first().waitFor(); // wait until the page has re-rendered in Thai
  await tp.getByTestId('quiz-more').click(); await tp.getByTestId('quiz-settings').click();
  ok(await tp.getByTestId('fullscreen-note').filter({ hasText: 'เต็มจอ' }).count() === 1, 'full-screen exam note translated');

  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
