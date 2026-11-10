const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql , copyToSections } = require('../lib');
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

  const tp = await firstLogin('T0001', 'Teach3rPass');
  // Dashboard to-do: demo has ungraded essay submissions + high-similarity lab
  const todo = tp.getByTestId('instructor-todo');
  ok(await todo.getByText('Lab 3: Linked list (Python)').count() === 1, 'instructor to-do lists Lab 3');
  ok(await todo.getByText('2 high-similarity submissions').count() >= 1, 'high-similarity count shown');
  ok(await tp.getByText('Sec 2').count() >= 1, 'both CS201 sections on the dashboard');
  await tp.screenshot({ path: S + '/s-dashboard-instructor.png', fullPage: true });

  // Section 1 / 2 URLs
  const links = tp.locator('a[href^="/courses/"]').filter({ hasText: 'CS201' });
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const sec2Href = (await tp.locator('a[href^="/courses/"]', { hasText: 'Sec 2' }).first().getAttribute('href'));
  const sec1Href = hrefs.find((h) => h !== sec2Href && !h.includes('/assignments'));

  // Create material in Sec 1 and also add to Sec 2
  await tp.goto(B + sec1Href);
  await tp.getByTestId('add-material').click();
  await tp.fill('#title', 'Week 5 slides');
  await tp.setInputFiles('#file', { name: 'week5.pdf', mimeType: 'application/pdf', buffer: Buffer.from('week5-bytes') });
  await tp.getByLabel('Sec 2').check();
  await tp.getByRole('dialog').getByRole('button', { name: 'Add material' }).click();
  await tp.getByText('Week 5 slides').waitFor();
  await tp.goto(B + sec2Href);
  ok(await tp.getByText('Week 5 slides').count() === 1, 'material also created in Sec 2');
  const dl = await tp.context().request.get(B + await tp.getByText('Week 5 slides').getAttribute('href'));
  ok((await dl.text()) === 'week5-bytes', 'Sec 2 has its own working copy of the file');

  // Copy existing assignment from Sec 1 → Sec 2
  await tp.goto(B + sec1Href + '/assignments');
  await tp.getByText('Lab 3: Linked list (Python)').click(); await tp.waitForURL(/assignments\/[^/]+$/);
  await copyToSections(tp, 'assignment');
  await tp.goto(B + sec2Href + '/assignments');
  await tp.getByText('Lab 3: Linked list (Python)').click(); await tp.waitForURL(/assignments\/[^/]+$/);
  ok(await tp.getByText('0/2 submitted').count() >= 1, 'copied assignment has no submissions in Sec 2');

  // New assignment created in both sections
  await tp.goto(B + sec1Href + '/assignments');
  await tp.getByTestId('new-assignment').click();
  await tp.fill('#a-title', 'Lab 4: Stacks');
  await tp.fill('#a-points', '10');
  await tp.getByLabel('Sec 2').check();
  await tp.getByRole('button', { name: 'Create assignment' }).click();
  await tp.waitForURL(/assignments\/[^/]+$/);
  await tp.goto(B + sec2Href + '/assignments');
  ok(await tp.getByText('Lab 4: Stacks').count() === 1, 'new assignment created in Sec 2 too');

  // Copy gradebook setup → Sec 2 gets categories; linked items present
  await tp.goto(B + sec1Href + '/grades');
  await copyToSections(tp, 'gradebook');
  await tp.goto(B + sec2Href + '/grades');
  const th = tp.locator('[data-testid=gradebook] th');
  ok(await th.filter({ hasText: 'Midterm exam' }).count() === 1 && await th.filter({ hasText: 'Lab 3' }).count() === 1 && await th.filter({ hasText: 'Lab 4' }).count() === 1, 'Sec 2 gradebook has copied items');
  ok(await tp.locator('[data-testid=gradebook] tbody tr').count() === 2, 'Sec 2 roster unchanged (2 cadets)');
  await tp.getByTestId('tab-setup').click();
  await tp.getByTestId('grade-setup').waitFor();
  const ws = await tp.getByTestId('weight-sum').textContent().catch(() => '(none)');
  ok(/Weights add up to 100%/.test(ws), 'categories + weights copied: ' + ws);
  await tp.getByTestId('tab-scores').click();
  const sec2Inputs = tp.locator('[data-testid=gradebook] tbody input');
  const values = await sec2Inputs.evaluateAll((els) => els.map((e) => e.value).join(''));
  ok(values === '', 'no scores copied');

  // Cadet dashboard: due soon list
  const c6 = await firstLogin('6601006', 'Cadet6pass9');
  const ct = c6.getByTestId('cadet-todo');
  ok(await ct.getByText('Lab 3: Linked list (Python)').count() === 1 && await ct.getByText('Lab 4: Stacks').count() === 1, 'cadet sees due-soon work from Sec 2');
  ok(await c6.getByTestId('instructor-todo').count() === 0, 'no instructor panel for cadets');
  await c6.screenshot({ path: S + '/s-dashboard-cadet.png', fullPage: true });
  // cadet in sec 2 can't see sec 1
  const r = await c6.goto(B + sec1Href);
  ok(r.status() === 404, 'Sec 2 cadet cannot open Sec 1');

  // Cadet 1 already submitted lab 3 → not listed
  const c1 = await firstLogin('6601001', 'Cadet1pass9');
  const c1t = c1.getByTestId('cadet-todo');
  ok(await c1t.getByText('Lab 3: Linked list (Python)').count() === 0 && await c1t.getByText('Lab 4: Stacks').count() === 1, 'submitted work drops off the cadet list');

  // Cadet 6 submits Lab 4 in Sec 2 → instructor sees 1 submission to grade
  await c6.goto(B + '/');
  await c6.getByTestId('cadet-todo').getByText('Lab 4: Stacks').click(); await c6.waitForURL(/assignments\/[^/]+$/);
  await c6.fill('#s-text', 'stack = []\nstack.append(1)');
  await c6.getByRole('button', { name: 'Submit' }).click(); await c6.getByText('Submitted.').waitFor();
  await tp.goto(B + '/');
  ok(await tp.getByTestId('instructor-todo').locator('li', { hasText: 'Lab 4: Stacks' }).getByText('1 submission to grade').count() === 1, 'ungraded submission appears on instructor dashboard');

  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
