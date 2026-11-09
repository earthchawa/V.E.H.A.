const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };

(async () => {
  const browser = await chromium.launch();
  const newPage = async () => (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  const firstLogin = async (u, newPw) => {
    const p = await newPage();
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', newPw); await p.fill('#confirmPassword', newPw);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/');
    return p;
  };
  const openCourse = async (p) => { await p.locator('ul.grid a', { hasText: 'CS201' }).filter({ hasNotText: 'Sec 2' }).click(); await p.waitForURL(/\/courses\/[^/]+$/); return p.url(); };

  // --- Cadet sees own report, anonymised ---
  const c2 = await firstLogin('6601002', 'Cadet2pass9');
  const course = await openCourse(c2);
  await c2.getByRole('link', { name: 'Assignments' }).click(); await c2.waitForURL(/assignments$/);
  ok(await c2.getByText('Lab 3: Linked list (Python)').count() === 1, 'cadet sees assignment list');
  await c2.getByText('Lab 3: Linked list (Python)').click(); await c2.waitForURL(/assignments\/[^/]+$/);
  const lab3 = c2.url();
  await c2.getByRole('link', { name: 'View similarity report' }).click(); await c2.waitForURL(/report/);
  const cadetReportUrl = c2.url();
  ok((await c2.getByTestId('overall').textContent()).trim() === '93%', 'cadet report shows overall 93%');
  ok(await c2.locator('mark.hl').count() > 0, 'report highlights copied passages');
  ok(await c2.getByText('Peer submission 1').count() === 1, 'source is anonymised for cadet');
  const body = await c2.content();
  ok(!body.includes('Cadet Demo 1') && !body.includes('6601001'), 'cadet cannot see the other cadet\'s identity');
  await c2.screenshot({ path: S + '/p2-report-cadet.png', fullPage: true });
  ok(!(await c2.getByRole('link', { name: /Compare/ }).count()), 'no compare link for cadet');

  // --- Cadet cannot open another cadet's report or the compare page ---
  const c1 = await firstLogin('6601001', 'Cadet1pass9');
  let r = await c1.goto(cadetReportUrl);
  ok(r.status() === 404 && !(await c1.content()).includes('Peer submission'), 'other cadet gets 404 on someone else\'s report');
  r = await c1.goto(lab3 + '/compare?a=x&b=y');
  ok(r.status() === 404, 'cadet gets 404 on compare');

  // --- Instructor: table, pairs, compare ---
  const tp = await firstLogin('T0001', 'Teach3rPass');
  await tp.goto(lab3);
  ok(await tp.getByTestId('similarity').count() === 3, 'instructor sees similarity for all 3 submissions');
  ok(await tp.getByTestId('pair').count() >= 1, 'top pairs listed');
  await tp.screenshot({ path: S + '/p2-assignment-instructor.png', fullPage: true });
  await tp.getByTestId('pair').first().click(); await tp.waitForURL(/compare/);
  ok(await tp.locator('section.card').count() === 2 && await tp.locator('mark.hl').count() > 1, 'compare shows both sides highlighted');
  ok(await tp.getByText('Cadet Demo 1').count() >= 1 && await tp.getByText('Cadet Demo 2').count() >= 1, 'instructor sees names');
  await tp.screenshot({ path: S + '/p2-compare.png', fullPage: true });

  // --- Instructor creates a new assignment; cadets submit text + PDF ---
  await tp.goto(course + '/assignments');
  await tp.getByTestId('new-assignment').click();
  await tp.fill('#a-title', 'Reflection: Week 4');
  await tp.fill('#a-instructions', 'อธิบายสิ่งที่ได้เรียนรู้ในสัปดาห์นี้');
  await tp.fill('#a-due', '2030-01-01T23:59');
  await tp.getByRole('button', { name: 'Create assignment' }).click();
  await tp.waitForURL(/assignments\/[^/]+$/);
  const refl = tp.url();
  ok(await tp.getByText('Reflection: Week 4').count() >= 1, 'assignment created');

  const shared = 'สัปดาห์นี้ได้เรียนรู้เรื่องการจัดการหน่วยความจำของลิงก์ลิสต์ การเพิ่มโหนดใหม่ไว้ด้านหน้าทำได้เร็วมากเพราะไม่ต้องเลื่อนข้อมูล และได้ฝึกเขียนฟังก์ชันลบโหนดที่ต้องระวังกรณีโหนดแรก';
  await c1.goto(refl);
  await c1.fill('#s-text', shared + ' นอกจากนี้ยังได้ทบทวนการวิเคราะห์ความซับซ้อนเชิงเวลา');
  await c1.setInputFiles('#s-files', F + '/sample.pdf');
  await c1.getByRole('button', { name: 'Submit' }).click();
  await c1.getByText('Submitted.').waitFor();
  ok(true, 'cadet 1 submitted text + PDF');
  await c2.goto(refl);
  await c2.fill('#s-text', 'บันทึกการเรียน: ' + shared);
  await c2.getByRole('button', { name: 'Submit' }).click();
  await c2.getByText('Submitted.').waitFor();
  await c2.reload();
  ok((await c2.getByTestId('similarity').first().textContent()).includes('%'), 'cadet sees similarity after submitting');
  await c2.getByRole('link', { name: 'View similarity report' }).click(); await c2.waitForURL(/report/);
  ok(parseInt(await c2.getByTestId('overall').textContent()) >= 50, 'shared Thai paragraph detected');

  await c1.reload();
  ok(await c1.getByText('sample.pdf').count() === 1, 'uploaded PDF listed');
  ok(await c1.getByText('not checked').count() === 0, 'PDF was analysed');
  await c1.getByRole('link', { name: 'View similarity report' }).click(); await c1.waitForURL(/report/);
  ok(await c1.getByText('Linked lists store nodes connected by pointers').count() === 1, 'PDF text shown in report');
  ok(await c1.getByText('▌ sample.pdf').count() + await c1.getByText('sample.pdf').count() >= 1, 'file header shown');

  // --- A rejected submission keeps the typed answer ---
  await c2.goto(refl);
  await c2.fill('#s-text', 'คำตอบยาวที่พิมพ์ไว้แล้วต้องไม่หาย');
  await c2.setInputFiles('#s-files', [1,2,3,4,5,6].map((i) => ({ name: `f${i}.txt`, mimeType: 'text/plain', buffer: Buffer.from('x' + i) })));
  await c2.getByRole('button', { name: 'Resubmit' }).click();
  await c2.getByText('Attach at most 5 files.').waitFor();
  ok(await c2.inputValue('#s-text') === 'คำตอบยาวที่พิมพ์ไว้แล้วต้องไม่หาย', 'answer text survives a rejected submission');

  // --- Resubmission bumps version ---
  await c2.goto(refl);
  await c2.fill('#s-text', 'เขียนใหม่ทั้งหมดด้วยคำของตัวเอง เรื่องหน่วยความจำและตัวชี้ของโครงสร้างข้อมูลแบบต่อเชื่อม');
  await c2.getByRole('button', { name: 'Resubmit' }).click();
  await c2.getByText('Submitted.').waitFor(); await c2.reload();
  ok(await c2.getByText('version 2').count() === 1, 'resubmission increments version');
  ok((await c2.getByTestId('similarity').first().textContent()).startsWith('0%'), 'rewritten work drops to 0%');

  // --- Hidden report visibility ---
  await tp.goto(refl);
  await tp.getByTestId('edit-assignment').click();
  await tp.selectOption('#a-vis', 'HIDDEN');
  await tp.getByRole('button', { name: 'Save changes' }).click();
  await tp.locator('dialog[open]').waitFor({ state: 'hidden' });
  await c1.goto(refl);
  ok(await c1.getByRole('link', { name: 'View similarity report' }).count() === 0, 'hidden: no report link for cadet');
  await c1.goto(c1.url()); 

  // --- Theme + language ---
  const pp = await newPage(); await pp.goto(B + '/login');
  ok(await pp.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark by default');
  await pp.getByTestId('theme-toggle').click();
  ok(await pp.evaluate(() => document.documentElement.dataset.theme) === 'light', 'toggle to light');
  await pp.getByRole('button', { name: 'TH' }).click();
  await pp.getByRole('heading', { name: 'เข้าสู่ระบบ' }).waitFor();
  await pp.reload();
  ok(await pp.evaluate(() => document.documentElement.dataset.theme) === 'light' && await pp.getByRole('heading', { name: 'เข้าสู่ระบบ' }).count() === 1, 'theme + language persist after reload');
  await pp.fill('#username', '6601002'); await pp.fill('#password', 'wrong');
  await pp.click('button[type=submit]');
  await pp.getByText('รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง').waitFor();
  ok(true, 'server error messages translated');
  ok(await pp.inputValue('#username') === '6601002', 'ID is kept after a failed sign-in');
  await pp.screenshot({ path: S + '/p2-login-light-th.png' });
  await pp.fill('#password', 'Cadet2pass9'); await pp.click('button[type=submit]'); await pp.waitForURL(B + '/');
  ok(await pp.getByRole('heading', { name: 'รายวิชาของฉัน' }).count() === 1, 'dashboard in Thai');
  await pp.goto(lab3);
  await pp.getByRole('link', { name: 'ดูรายงานความคล้าย' }).click(); await pp.waitForURL(/report/);
  ok(await pp.getByText('งานของเพื่อน #1').count() === 1, 'report in Thai');
  await pp.screenshot({ path: S + '/p2-report-light-th.png', fullPage: true });

  await browser.close();
  console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
