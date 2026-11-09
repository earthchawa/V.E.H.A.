const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };

(async () => {
  const browser = await chromium.launch();
  const firstLogin = async (u, np) => {
    const p = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };

  // --- Instructor gradebook ---
  const tp = await firstLogin('T0001', 'Teach3rPass');
  await tp.locator('ul.grid a', { hasText: 'CS201' }).filter({ hasNotText: 'Sec 2' }).click(); await tp.waitForURL(/courses\/[^/]+$/);
  const course = tp.url();
  await tp.getByRole('link', { name: 'Grades' }).click(); await tp.waitForURL(/grades$/);
  ok(await tp.getByTestId('gradebook').count() === 1, 'gradebook grid shown');
  const rows = tp.locator('[data-testid=gradebook] tbody tr');
  ok(await rows.count() === 5, '5 cadets listed');
  // Cadet 1: lab 9/10, essay 14/20 → hw 23/30=76.67; mid 42/50=84 → (40*76.67+25*84)/65 = 79.49 → B+
  const r1 = rows.filter({ hasText: '6601001' });
  ok((await r1.getByTestId('total').textContent()) === '79.5%' && (await r1.getByTestId('letter').textContent()) === 'B+', 'weighted total + letter computed (79.5%, B+)');
  await tp.screenshot({ path: S + '/p3-gradebook.png', fullPage: true });

  // edit: give cadet 1 final 90/100 → (40*76.67 + 25*84 + 35*90)/100 = 83.17 → A (live)
  const finalInput = r1.locator('input').nth(3);
  await finalInput.fill('90');
  ok((await r1.getByTestId('letter').textContent()) === 'A', 'live recalculation while typing');
  ok(await tp.getByText('1 unsaved changes').count() === 1, 'dirty cell counted');
  // invalid value blocks saving
  await r1.locator('input').nth(0).fill('11');
  ok(await tp.getByRole('button', { name: 'Save grades' }).isDisabled(), 'score above max blocks save');
  await r1.locator('input').nth(0).fill('9');
  await tp.getByRole('button', { name: 'Save grades' }).click();
  await tp.getByText('Saved 1 scores.').waitFor();
  await tp.reload();
  ok((await rows.filter({ hasText: '6601001' }).getByTestId('letter').textContent()) === 'A', 'saved score persists');

  // add standalone item + category weight warning
  await tp.getByTestId('tab-setup').click(); await tp.getByTestId('grade-setup').waitFor();
  ok(await tp.getByTestId('weight-sum').filter({ hasText: 'Weights add up to 100%' }).count() === 1, 'weights sum shown');
  await tp.getByPlaceholder('Name, e.g. Midterm exam').fill('Participation');
  await tp.getByPlaceholder('Full marks').fill('5');
  await tp.getByRole('button', { name: 'Add column' }).click();
  await tp.getByTestId('setup-items').getByText('Participation').waitFor();
  await tp.getByTestId('tab-scores').click();
  await tp.locator('[data-testid=gradebook] th', { hasText: 'Participation' }).waitFor();
  ok(true, 'standalone grade column added');

  // CSV export
  const csv = await tp.context().request.get(course.replace('/courses/', '/api/offerings/') + '/grades');
  const text = await csv.text();
  ok(csv.status() === 200 && text.includes('6601001') && text.includes('total %') && text.includes(',A,4'), 'CSV export with totals and grade points');

  // grade from report page + release essay
  await tp.goto(course + '/assignments');
  await tp.getByText('Essay: Arrays vs. linked lists').click(); await tp.waitForURL(/assignments\/[^/]+$/);
  ok(await tp.getByText('14 / 20').count() === 1, 'score column on assignment page');
  await tp.locator('tr', { hasText: '6601004' }).getByRole('link', { name: 'Report' }).click(); await tp.waitForURL(/report/);
  await tp.fill('#g-points', '9');
  await tp.fill('#g-feedback', 'ย่อหน้าที่ 2 ซ้ำกับงานของเพื่อน กรุณาเขียนด้วยคำของตัวเอง');
  await tp.getByRole('button', { name: 'Save grade' }).click();
  await tp.getByText('Saved.').waitFor();
  ok(true, 'graded from the report page');
  await tp.screenshot({ path: S + '/p3-report-grading.png', fullPage: true });

  // --- Cadet view before release ---
  const c4 = await firstLogin('6601004', 'Cadet4pass9');
  await c4.goto(course + '/grades');
  ok(await c4.getByText('Essay: Arrays vs. linked lists').count() === 0, 'hidden item not visible to cadet');
  ok(await c4.getByText('Midterm exam').count() === 1, 'released item visible');

  // release essay
  await tp.goto(course + '/grades');
  await tp.getByTestId('tab-setup').click();
  await tp.locator('li', { hasText: 'Essay: Arrays vs. linked lists' }).getByRole('button', { name: /Hidden from cadets/ }).click();
  await tp.locator('li', { hasText: 'Essay: Arrays vs. linked lists' }).getByRole('button', { name: /Visible to cadets/ }).waitFor();

  await c4.reload();
  ok(await c4.getByText('Essay: Arrays vs. linked lists').count() === 1, 'released item now visible');
  ok(await c4.getByText('กรุณาเขียนด้วยคำของตัวเอง').count() === 1, 'feedback visible to cadet');
  // c4: essay 9/20 (hw 45%), mid 30/50 (60%) → (40*45 + 25*60)/65 = 50.77 → D
  ok((await c4.getByTestId('my-letter').textContent()) === 'D', 'cadet sees running grade (D)');
  await c4.screenshot({ path: S + '/p3-cadet-grades.png', fullPage: true });
  await c4.goto(course + '/assignments');
  await c4.getByText('Essay: Arrays vs. linked lists').click(); await c4.waitForURL(/assignments\/[^/]+$/);
  ok((await c4.getByTestId('assignment-score').textContent()).includes('9'), 'score shown on the assignment page');

  // hide total
  await tp.goto(course + '/grades');
  await tp.getByTestId('tab-setup').click();
  await tp.getByRole('button', { name: 'Show cadets their running total and grade' }).click();
  await tp.waitForTimeout(800);
  await c4.goto(course + '/grades');
  ok(await c4.getByTestId('my-letter').count() === 0, 'running total can be hidden from cadets');

  // cadet cannot export or save
  const r = await c4.context().request.get(course.replace('/courses/', '/api/offerings/') + '/grades');
  ok(r.status() === 404, 'cadet cannot export the gradebook');

  // Thai mode
  await c4.getByRole('button', { name: 'TH' }).click();
  await c4.getByRole('link', { name: 'คะแนน' }).waitFor();
  ok(true, 'Grades tab translated');

  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
