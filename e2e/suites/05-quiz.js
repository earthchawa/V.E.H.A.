const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };

(async () => {
  const browser = await chromium.launch();
  const firstLogin = async (u, np, ua) => {
    const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(ua ? { userAgent: ua } : {}) })).newPage();
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };
  const q = (p, text) => p.locator('[data-testid=question]', { hasText: text });
  const enterFs = async (p) => {
    const btn = p.getByRole('button', { name: 'Return to full screen' });
    await btn.waitFor({ timeout: 5000 }).catch(() => {});
    if (await btn.count()) await btn.click();
    await p.getByTestId('fullscreen-overlay').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  };

  // ---------- Cadet 1 takes the quiz ----------
  const c1 = await firstLogin('6601001', 'Cadet1pass9');
  await c1.getByTestId('cadet-todo').getByText('Quiz 1: Linked lists').click();
  await c1.getByRole('button', { name: 'Start quiz' }).waitFor();
  ok(await c1.getByText('You have 20 minutes').count() === 1, 'rules show the time limit');
  await c1.getByRole('button', { name: 'Start quiz' }).click();
  await c1.waitForURL(/\/exam\//);
  const examUrl = c1.url();
  ok(!(await c1.content()).includes('"correct"'), 'correct answers are not sent to the browser');
  await enterFs(c1);
  ok(await c1.getByTestId('question').count() === 5, '5 questions shown');
  ok(/\d+:\d\d/.test(await c1.getByTestId('timer').textContent()), 'countdown visible');

  await q(c1, 'inserting at the head').getByLabel('O(1)').check();
  await q(c1, 'ลิงก์ลิสต์').getByLabel('เพิ่ม/ลบข้อมูลตรงกลาง').check();
  await q(c1, 'ลิงก์ลิสต์').getByLabel('ขยายขนาดได้ตามต้องการ').check();
  await q(c1, 'doubly linked').getByLabel('True').check();
  await q(c1, 'first node').getByRole('textbox').fill('  Head ');
  await q(c1, 'reverse(head)').getByRole('textbox').fill('def reverse(head):\n    prev = None\n    while head:\n        head.next, prev, head = prev, head, head.next\n    return prev');
  await c1.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor();
  ok(true, 'answers autosaved');
  // integrity events
  await c1.evaluate(() => document.dispatchEvent(new Event('paste', { cancelable: true })));
  await c1.locator('[data-testid=integrity-warning][data-kind=blocked]').waitFor({ timeout: 3000 });
  ok(true, 'blocked paste shows a yellow note to the cadet');
  await c1.evaluate(() => window.dispatchEvent(new Event('blur')));
  await c1.waitForTimeout(1500);
  await c1.evaluate(() => window.dispatchEvent(new Event('focus')));
  const warnLeft = c1.locator('[data-testid=integrity-warning][data-kind=left]');
  await warnLeft.waitFor({ timeout: 3000 });
  ok((await warnLeft.textContent()).includes('time 1'), 'coming back shows a red warning with the count');
  await warnLeft.getByRole('button', { name: 'I understand' }).click();
  ok(await warnLeft.count() === 0, 'red warning dismissed');
  await c1.waitForTimeout(4500);
  // reload keeps answers
  await c1.reload();
  await enterFs(c1);
  ok(await q(c1, 'first node').getByRole('textbox').inputValue() === '  Head ', 'answers survive a reload');
  ok(await c1.getByTestId('answered').textContent() === '5/5 answered', 'answered counter');
  await c1.getByRole('button', { name: 'Submit quiz' }).first().click();
  await c1.getByTestId('confirm-submit').click();
  await c1.waitForURL(/quizzes\/[^/]+$/);
  ok(await c1.getByTestId('quiz-done').count() === 1, 'submitted');
  ok(await c1.getByText('Results will be available after the quiz closes.').count() === 1, 'results hidden until close');
  const r = await c1.goto(examUrl); ok(c1.url().includes('/quizzes/'), 'exam page closed after submit');

  // ---------- Cadet 2: times out ----------
  const c2 = await firstLogin('6601002', 'Cadet2pass9');
  await c2.goto(c1.url());
  await c2.getByRole('button', { name: 'Start quiz' }).click(); await c2.waitForURL(/\/exam\//);
  const exam2 = c2.url();
  await enterFs(c2);
  await q(c2, 'inserting at the head').getByLabel('O(n)', { exact: true }).check();
  await c2.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor();

  // ---------- Instructor watches live while cadet 2 is in the quiz ----------
  const tp = await firstLogin('T0001', 'Teach3rPass');
  const resultsUrl = c1.url().split('?')[0] + '/results';
  await tp.goto(resultsUrl);
  const liveRow = tp.locator('[data-testid=quiz-results] tr', { hasText: '6601002' });
  ok(await tp.getByTestId('live-refresh').count() === 1, 'results page updates live while a cadet is in the quiz');
  ok((await liveRow.getByTestId('presence').getAttribute('data-presence')) === 'active', 'live: cadet shown on the quiz page');
  await c2.evaluate(() => window.dispatchEvent(new Event('blur')));
  await liveRow.locator('[data-testid=presence][data-presence=away]').waitFor({ timeout: 12000 });
  ok((await liveRow.getByTestId('presence').textContent()).includes('Away from the quiz'), 'live: cadet away shown in red without reloading');
  await c2.evaluate(() => window.dispatchEvent(new Event('focus')));
  await liveRow.locator('[data-testid=presence][data-presence=active]').waitFor({ timeout: 12000 });
  ok(true, 'live: back on the quiz page');
  // other cadet cannot open this exam page
  const stolen = await c1.goto(exam2); ok(stolen.status() === 404, 'another cadet cannot open someone else\'s exam');
  // force the deadline into the past → auto-submit on next load
  const attemptId = exam2.split('/exam/')[1];
  sql(`update "QuizAttempt" set "deadlineAt" = now() - interval '2 minutes' where id = '${attemptId}'`);
  await c2.reload();
  await c2.waitForURL(/quizzes\/[^/]+/);
  ok(await c2.getByText('Time ran out').count() === 1, 'expired attempt auto-submitted');

  // ---------- Instructor grades ----------
  await tp.goto(B + '/');
  ok(await tp.getByTestId('instructor-todo').getByText('1 quiz answer to grade').count() === 1, 'dashboard: quiz answers to grade');
  await tp.getByTestId('instructor-todo').getByText('Quiz 1: Linked lists').click(); await tp.waitForURL(/results$/);
  const quizBase = tp.url().replace(/\/results$/, '');
  const row1 = tp.locator('[data-testid=quiz-results] tr', { hasText: '6601001' });
  ok((await row1.getByTestId('attempt-score').textContent()).trim() === '5* / 10', 'auto-graded 5/10, essay pending (*)');
  ok((await row1.getByTestId('attempt-events').textContent()).includes('event'), 'integrity events counted');
  ok((await row1.getAttribute('data-level')) === 'red', 'three or more minor events mark the row red');
  ok(await tp.getByTestId('live-refresh').count() === 0, 'no live updates once nobody is in the quiz');
  const row2 = tp.locator('[data-testid=quiz-results] tr', { hasText: '6601002' });
  ok((await row2.getByTestId('attempt-score').textContent()).trim() === '0 / 10', 'timed-out attempt scored (blank essay = 0)');
  await tp.screenshot({ path: S + '/q-results.png', fullPage: true });

  // grade essay by question
  await tp.locator('a', { hasText: 'reverse(head)' }).click(); await tp.waitForURL(/grade\//);
  const rows = tp.getByTestId('grade-row');
  ok(await rows.count() === 2, 'grade-by-question lists both cadets');
  const r1 = rows.filter({ hasText: '6601001' });
  await r1.getByLabel('Score').fill('4');
  await r1.getByLabel('Feedback').fill('ถูกต้อง แต่ควรอธิบายการสลับตัวชี้');
  await tp.getByRole('button', { name: 'Save grades' }).click();
  await tp.getByText('Saved 1 scores.').waitFor();
  await tp.screenshot({ path: S + '/q-grade-question.png', fullPage: true });

  // attempt review shows total + integrity log
  await tp.goto(quizBase + '/results');
  await row1.getByRole('link', { name: 'Review' }).click(); await tp.waitForURL(/attempts\//);
  ok((await tp.getByTestId('attempt-total').textContent()).replace(/\s+/g, ' ').trim() === '9 / 10', 'attempt total 9/10 after grading');
  const log = await tp.getByTestId('event-log').textContent();
  ok(log.includes('Left the quiz window') && log.includes('Pasted text') && log.includes('Opened the quiz page again'), 'integrity log lists blur, paste and reload');
  ok((log.match(/Left the quiz window/g) || []).length === 1, 'submitting does not log a false focus loss');
  ok(/Left the quiz window · \d+ s/.test(log), 'time away recorded: ' + log);
  ok(!log.includes('Switched tab'), 'reloading the page is not logged as switching tab');
  ok((await tp.getByTestId('integrity-summary').textContent()).includes('away'), 'integrity summary shows total time away');
  await tp.screenshot({ path: S + '/q-attempt.png', fullPage: true });

  // gradebook got the score
  await tp.goto(quizBase.replace(/quizzes\/.*/, 'grades'));
  const gbRow = tp.locator('[data-testid=gradebook] tbody tr', { hasText: '6601001' });
  const headers = await tp.locator('[data-testid=gradebook] thead th').allTextContents();
  const col = headers.findIndex((h) => h.includes('Quiz 1')) - 1;
  ok(col >= 0 && (await gbRow.locator('input').nth(col).inputValue()) === '9', 'quiz score flows into the gradebook');

  // regrade: change correct answer of Q1 to O(n) → cadet1 8, cadet2 1
  await tp.goto(quizBase);
  const b1 = tp.getByTestId('builder-question').filter({ hasText: 'inserting at the head' });
  await b1.getByRole('button', { name: 'Edit' }).click();
  await b1.locator('input[name=optText]').nth(2).waitFor();
  const texts = await b1.locator('input[name=optText]').evaluateAll((els) => els.map((e) => e.value));
  await b1.locator('input[name=optCorrect]').nth(texts.indexOf('O(n)')).check();
  await b1.getByRole('button', { name: 'Save question' }).click();
  await tp.locator('dialog[open]').waitFor({ state: 'hidden' });
  await tp.goto(quizBase + '/results');
  ok((await row1.getByTestId('attempt-score').textContent()).trim() === '8 / 10' && (await row2.getByTestId('attempt-score').textContent()).trim() === '1 / 10', 'changing the key re-grades automatic answers');

  // close the quiz → cadet sees score + feedback
  sql(`update "Quiz" set "closesAt" = now() - interval '1 minute' where title = 'Quiz 1: Linked lists'`);
  await c1.goto(quizBase);
  ok((await c1.getByTestId('quiz-score').textContent()).replace(/\s+/g, ' ').trim() === '8 / 10', 'cadet sees score after close');
  ok(await c1.getByText('ควรอธิบายการสลับตัวชี้').count() === 1, 'cadet sees feedback (FULL results)');
  await c1.screenshot({ path: S + '/q-cadet-results.png', fullPage: true });

  // ---------- SEB + IP restrictions ----------
  sql(`update "Quiz" set "closesAt" = now() + interval '1 day', "requireSeb" = true where title = 'Quiz 1: Linked lists'`);
  const c3 = await firstLogin('6601003', 'Cadet3pass9');
  await c3.goto(quizBase);
  // Safe Exam Browser is switched off (SEB_ENABLED unset): a leftover requireSeb flag is ignored.
  ok(await c3.getByTestId('quiz-blocked').count() === 0 && await c3.getByRole('button', { name: 'Start quiz' }).count() === 1, 'SEB switched off: requireSeb ignored, normal browser can start');
  // Instructor switches back to a normal browser but restricts the quiz to the "CS Lab 301" exam room (10.20.3.0/24).
  await tp.goto(quizBase);
  await tp.getByTestId('quiz-settings').click();
  await tp.getByLabel('Only in these exam rooms').check();
  await tp.getByLabel('CS Lab 301').check();
  await tp.getByRole('button', { name: 'Save settings' }).click();
  await tp.locator('dialog[open]').waitFor({ state: 'hidden' });
  ok((await tp.getByTestId('settings-summary').textContent()).includes('CS Lab 301'), 'exam room chosen in plain-language settings');
  await c3.reload();
  ok(await c3.getByTestId('quiz-blocked').textContent() === 'You can only take this quiz from the exam room network.', 'IP outside the exam room blocked');
  sql(`update "ExamNetwork" set cidrs = E'127.0.0.0/8\n::1' where name = 'CS Lab 301'`);
  await c3.reload();
  ok(await c3.getByRole('button', { name: 'Start quiz' }).count() === 1, 'allowed network can start');

  // Thai UI on the exam page
  await c3.getByRole('button', { name: 'TH' }).click();
  await c3.getByRole('button', { name: 'เริ่มทำแบบทดสอบ' }).waitFor();
  ok(true, 'quiz page translated');

  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
