const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql , confirmOk, copyToSections } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
// Demo submissions hold their analysed content directly: drop the "▌ file name" header line.
const fileText = (user) => sql(`select s.content from "Submission" s join "User" u on u.id=s."studentId" join "Assignment" a on a.id=s."assignmentId" where u.username='${user}' and a.title like 'Lab 3%' limit 1`).split('\n').slice(1).join('\n');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const firstLogin = async (u, np) => {
    const p = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
    p.on('pageerror', (e) => errors.push(u + ': ' + e.message));
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };

  // ---------- Rename ----------
  const lp = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 })).newPage();
  await lp.goto(B + '/login');
  ok((await lp.getByTestId('brand-name').textContent()) === 'V.E.H.A.', 'brand renamed to V.E.H.A.');
  ok((await lp.getByTestId('brand-full-name').textContent()) === 'Virtual Educational Hangar for Air-cadets', 'full name shown on sign-in');
  ok((await lp.title()).includes('V.E.H.A.'), 'page title uses the new name: ' + await lp.title());
  await lp.screenshot({ path: S + '/r9-login.png' });

  // ---------- Earlier-term reference: Sec 2 runs Lab 3; cadet 6 hands in cadet 1's program ----------
  const tp = await firstLogin('T0001', 'Teach3rPass');
  await tp.locator('ul.grid a', { hasText: 'CS201' }).filter({ hasNotText: 'Sec 2' }).first().click(); await tp.waitForURL(/courses\/[^/]+$/);
  const sec1 = tp.url();
  await tp.goto(sec1 + '/assignments');
  await tp.getByText('Lab 3: Linked list (Python)').click(); await tp.waitForURL(/assignments\/[^/]+$/);
  const lab3 = tp.url();
  ok(await tp.getByTestId('reference-library').count() === 1, 'reference library card shown to the instructor');
  await tp.getByTestId('add-reference-past').click();
  ok(await tp.getByText('No other run of this course has submissions yet.').count() === 1, 'no earlier runs yet');
  await tp.keyboard.press('Escape');
  await copyToSections(tp, 'assignment');

  const c6 = await firstLogin('6601006', 'Cadet6pass9');
  await c6.getByTestId('cadet-todo').getByText('Lab 3: Linked list (Python)').click(); await c6.waitForURL(/assignments\/[^/]+$/);
  await c6.locator('input[type=file]').setInputFiles({ name: 'old.py', mimeType: 'text/x-python', buffer: Buffer.from(fileText('6601001')) });
  await c6.getByRole('button', { name: 'Submit' }).click();
  await c6.getByText('Submitted.').waitFor({ timeout: 10000 }).catch(async () => { await c6.screenshot({ path: S + '/r9-c6.png', fullPage: true }); console.log(await c6.locator('form').last().textContent()); throw new Error('submit failed'); });

  await tp.goto(lab3);
  await tp.getByTestId('add-reference-past').click();
  const opt = await tp.locator('#src-past option').first().textContent();
  ok(/Section 2 — Lab 3/.test(opt) && /1 submitted/.test(opt), 'Sec 2 run offered as a reference: ' + opt);
  await tp.getByRole('dialog').getByRole('button', { name: 'Add and check again' }).click();
  await tp.locator('dialog[open]').waitFor({ state: 'hidden' });
  const ref1 = tp.getByTestId('reference').filter({ hasText: 'Earlier semester' });
  ok(await ref1.count() === 1, 'earlier-term reference listed');
  // Cadet 6 handed in cadet 1's program; the demo's cadet 2 copied cadet 1 too, so both match.
  ok(/matches 2 cadet\(s\), up to (9\d|100)%/.test(await ref1.textContent()), 'it matches cadets 1 and 2: ' + (await ref1.textContent()));

  // ---------- Reference document (e.g. a web page / AI answer) matching cadet 3 ----------
  await tp.getByTestId('add-reference-doc').click();
  await tp.fill('#src-title', 'GeeksforGeeks — Linked list in Python');
  await tp.fill('#src-url', 'not a url');
  await tp.fill('#src-text', fileText('6601003'));
  await tp.getByRole('dialog').getByRole('button', { name: 'Add and check again' }).click();
  ok(await tp.locator('#src-url').evaluate((i) => !i.validity.valid), 'bad link rejected by the browser');
  ok((await tp.inputValue('#src-text')).length > 100, 'text survives the error');
  await tp.fill('#src-url', 'https://www.geeksforgeeks.org/linked-list-in-python/');
  await tp.getByRole('dialog').getByRole('button', { name: 'Add and check again' }).click();
  await tp.locator('dialog[open]').waitFor({ state: 'hidden' });
  const ref2 = tp.getByTestId('reference').filter({ hasText: 'GeeksforGeeks' });
  ok(/matches 1 cadet\(s\)/.test(await ref2.textContent()), 'document reference matches cadet 3');
  await tp.screenshot({ path: S + '/r9-assignment.png', fullPage: true });

  // instructor report for cadet 1 and cadet 3
  await tp.locator('tr', { hasText: '6601001' }).getByRole('link', { name: 'Report' }).click(); await tp.waitForURL(/report\//);
  const src1 = await tp.getByTestId('source').allTextContents();
  ok(src1.some((s) => /Section 2 — Lab 3.*#1/.test(s) && s.includes('Earlier semester')), 'cadet 1 report: earlier-term source named for the instructor: ' + JSON.stringify(src1));
  await tp.goto(lab3);
  await tp.locator('tr', { hasText: '6601003' }).getByRole('link', { name: 'Report' }).click(); await tp.waitForURL(/report\//);
  const src3 = tp.getByTestId('source').filter({ hasText: 'GeeksforGeeks' });
  ok(await src3.count() === 1, 'cadet 3 report lists the document');
  await src3.click();
  ok(await tp.getByRole('link', { name: 'https://www.geeksforgeeks.org/linked-list-in-python/' }).count() === 1, 'document link shown');
  ok((await tp.getByTestId('overall').textContent()) !== '0%', 'overall includes the reference: ' + await tp.getByTestId('overall').textContent());
  await tp.screenshot({ path: S + '/r9-report.png', fullPage: true });

  // ---------- Cadet view: anonymous ----------
  const c1 = await firstLogin('6601001', 'Cadet1Pass');
  sql(`update "Assignment" set "reportVisibility"='IMMEDIATE' where title like 'Lab 3%'`);
  await c1.goto(lab3);
  await c1.getByRole('link', { name: 'View similarity report' }).click({ timeout: 8000 }).catch(async () => { await c1.screenshot({ path: S + '/r9-c1.png', fullPage: true }); console.log('C1:', c1.url(), (await c1.locator('main').textContent()).slice(0, 600)); throw new Error('no report link'); });
  await c1.waitForURL(/report\//);
  const cs = await c1.getByTestId('source').allTextContents();
  ok(cs.some((s) => s.includes('Earlier-semester submission 1')) && !cs.some((s) => s.includes('Section 2')), 'cadet sees an anonymous earlier-term source: ' + JSON.stringify(cs));

  // ---------- Remove + audit ----------
  await tp.goto(lab3);
  await tp.getByTestId('reference').filter({ hasText: 'GeeksforGeeks' }).getByRole('button', { name: 'Remove' }).click();
  await confirmOk(tp);
  await tp.getByTestId('reference').filter({ hasText: 'GeeksforGeeks' }).waitFor({ state: 'detached' });
  ok(await tp.getByTestId('reference').count() === 1, 'reference removed');
  ok(Number(sql(`select count(*) from "AuditLog" where action='similarity.source_added'`)) === 2, 'adding references is audited');
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
