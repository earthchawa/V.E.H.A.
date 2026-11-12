// Year levels (per academic year, promotion), deleting a section, switches, the copy dialog,
// confirm dialogs, toasts, the list rows and the softer light theme.
const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };

(async () => {
  const browser = await chromium.launch();
  const firstLogin = async (u, np, cookies = []) => {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    if (cookies.length) await ctx.addCookies(cookies.map(([name, value]) => ({ name, value, url: B })));
    const p = await ctx.newPage();
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', PW[u]);
    await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };
  const yearOf = (u, y) => sql(`select cy."yearLevel" from "CadetYear" cy join "User" u on u.id = cy."userId" where u.username = '${u}' and cy."academicYear" = ${y}`);

  // ---------- Year levels ----------
  const ap = await firstLogin('admin', 'Adm1nPass99');
  await ap.goto(B + '/admin/users?role=STUDENT&view=list');
  const yearCell = (u) => ap.locator(`[data-username="${u}"] [data-testid=user-year]`);
  ok((await yearCell('6601001').innerText()).trim() === 'Year 2', 'cadet list shows this year\'s year level');
  ok((await yearCell('6601006').innerText()).trim() === '—', 'a cadet without a year level shows a dash');
  await ap.getByTestId('year-filter').selectOption('2');
  await ap.waitForURL(/year=2/);
  await ap.waitForFunction(() => document.querySelectorAll('[data-testid=user-row]').length === 5);
  ok(true, 'filter by year level lists the five year-2 cadets');
  await ap.getByTestId('year-filter').selectOption('none');
  await ap.waitForFunction(() => document.querySelectorAll('[data-testid=user-row]').length === 2);
  ok(true, '"No year level" lists the cadets without one');
  await ap.goto(B + '/admin/users?role=INSTRUCTOR');
  ok(await ap.getByTestId('year-filter').count() === 0 && await ap.getByTestId('user-year').count() === 0, 'no year column on the instructors tab');
  // Instructors tab: one card per department (กองวิชา), its subject areas inside; empty departments still listed.
  const topDepts = sql(`select count(*) from "Department" where "parentId" is null`);
  ok(String(await ap.getByTestId('staff-dept').count()) >= topDepts && await ap.getByTestId('user-row').count() === 0, `instructors tab opens on ${topDepts}+ department cards`);
  const mc = ap.getByTestId('staff-dept').filter({ hasText: 'Mathematics and Computer' });
  const mcTotal = sql(`select count(*) from "User" u join "Department" d on d.id=u."departmentId" left join "Department" p on p.id=d."parentId" where u.role='INSTRUCTOR' and (d.code='MC' or p.code='MC')`);
  ok((await mc.innerText()).includes(mcTotal) && await mc.getByTestId('dept-area').count() > 0, `MC card counts its subject areas' ${mcTotal} instructors`);
  await mc.locator('a').first().click(); await ap.waitForURL(/dept=/);
  await ap.waitForFunction((k) => document.querySelectorAll('[data-testid=user-row]').length === k, Number(mcTotal));
  ok(true, 'a department card lists the instructors of the department and its subject areas');

  // Cadets tab opens on an overview by department and year level; each number opens that slice of the list.
  await ap.goto(B + '/admin/users?role=STUDENT');
  ok(await ap.getByTestId('user-row').count() === 0 && await ap.getByTestId('cadet-dept').count() > 0, 'cadets tab opens on the overview, not a long list');
  const yearTotal = sql(`select count(*) from "CadetYear" y join "User" u on u.id=y."userId" where u.role='STUDENT' and y."academicYear"=2569 and y."yearLevel"=2`);
  ok((await ap.getByTestId('year-chips').innerText()).includes('Year 2 ' + yearTotal) || (await ap.getByTestId('year-chips').innerText()).replace(/\s+/g, ' ').includes('Year 2 ' + yearTotal), 'year chips count the cadets per year level');
  const chip = ap.getByTestId('cadet-dept').first().getByTestId('dept-year').first();
  const n = Number((await chip.innerText()).trim().match(/(\d+)$/)[1]);
  await chip.click(); await ap.waitForURL(/year=/);
  await ap.waitForFunction((k) => document.querySelectorAll('[data-testid=user-row]').length === k, n);
  ok(/dept=/.test(ap.url()), `a department's year chip lists its ${n} cadets`);
  await ap.goto(B + '/admin/users?role=STUDENT');
  await ap.getByTestId('cadet-dept').first().locator('a').first().click(); await ap.waitForURL(/dept=/);
  const yearGroups = await ap.getByTestId('user-group').allInnerTexts();
  ok(yearGroups.length > 0 && yearGroups.every((g) => /^(Year \d|No year level)/.test(g.trim())), 'one department\'s cadets are grouped by year level: ' + yearGroups.join(' | '));
  await ap.getByTestId('user-view').getByRole('link', { name: 'Full list' }).click(); await ap.waitForURL(/view=list/);
  ok(await ap.getByTestId('user-row').count() > 0, '"Full list" shows everyone');

  // Manage dialog: set a year level; history shows earlier years.
  await ap.goto(B + '/admin/users?role=STUDENT&view=list');
  await ap.locator('[data-username="6601006"]').getByTestId('manage-user').click();
  const dlg = ap.locator('dialog[open]');
  ok((await getComputedAnim(dlg)) === 'modal-in', 'dialogs animate in');
  await dlg.getByTestId('year-level').selectOption('3');
  await dlg.getByRole('button', { name: 'Save changes' }).click();
  await ap.waitForFunction(() => !document.querySelector('dialog[open]'));
  ok(await ap.getByTestId('toaster').getByRole('status').count() === 1, 'saving in a dialog confirms with a toast');
  ok(yearOf('6601006', 2569) === '3', 'year level saved for the current academic year');
  ok((await yearCell('6601006').innerText()).trim() === 'Year 3', 'the list shows the new year level');
  ok(sql(`select details::text from "AuditLog" where action = 'user.updated' order by "createdAt" desc limit 1`).includes('"yearLevel"'), 'the change is audited');
  await ap.locator('[data-username="6601001"]').getByTestId('manage-user').click();
  const hist = await ap.locator('dialog[open]').getByTestId('year-history').innerText();
  ok(/2568.*Year 1/s.test(hist) && /2569.*Year 2/s.test(hist), 'year-level history lists every academic year');
  await ap.keyboard.press('Escape');
  await ap.waitForFunction(() => !document.querySelector('dialog[open]'));
  ok(true, 'Esc closes the dialog (after its closing animation)');

  // Import: a year column creates the record, and sets it for cadets who already have an account.
  await ap.getByTestId('import-users').click();
  await ap.locator('dialog[open] textarea[name=csv]').fill('username,fullName,role,email,department,password,year\n9101,Cadet New One,cadet,,CS,,1\n6601007,Cadet Demo 7,cadet,,,,3\n6601002,Cadet Demo 2,cadet');
  await ap.locator('dialog[open] button[type=submit]').click();
  const msg = await ap.locator('dialog[open] [role=status]').first().innerText();
  ok(/Created 1 account/.test(msg) && /year level set for 1 existing/.test(msg) && /skipped 1/.test(msg), 'import reports created / year set / skipped: ' + msg.slice(0, 120));
  ok(yearOf('9101', 2569) === '1' && yearOf('6601007', 2569) === '3' && yearOf('6601002', 2569) === '2', 'import wrote the year levels and left others alone');
  await ap.keyboard.press('Escape');
  await ap.waitForFunction(() => !document.querySelector('dialog[open]'));
  await ap.getByTestId('import-users').click();
  await ap.locator('dialog[open] textarea[name=csv]').fill('9102,Cadet Bad Year,cadet,,,,9');
  await ap.locator('dialog[open] button[type=submit]').click();
  ok(/year level/.test(await ap.locator('dialog[open] [role=alert]').innerText()), 'a bad year level is rejected with its line');
  await ap.keyboard.press('Escape');
  await ap.waitForFunction(() => !document.querySelector('dialog[open]'));

  // Promotion: 2569 → 2570. One cadet is in the final year and graduates.
  sql(`update "CadetYear" set "yearLevel" = 4 where "academicYear" = 2569 and "userId" = (select id from "User" where username = '6601005')`);
  await ap.reload();
  await ap.getByTestId('promote').click();
  const pf = ap.getByTestId('promote-form');
  const preview = await pf.getByTestId('promote-preview').innerText();
  ok(/Year 2[\s\S]*4 cadets[\s\S]*Year 3/.test(preview) && /Year 4[\s\S]*1 cadets[\s\S]*graduates/.test(preview), 'promotion preview shows who moves up and who graduates');
  await pf.locator('input[name=disableGraduates]').check();
  await pf.locator('button[type=submit]').click();
  const pm = await pf.locator('[role=status]').innerText();
  ok(/2570/.test(pm) && /moved up 7/.test(pm) && /graduated 1/.test(pm), 'promotion result: ' + pm);
  ok(yearOf('6601001', 2570) === '3' && yearOf('6601006', 2570) === '4' && yearOf('9101', 2570) === '2', 'everyone moved up one year in 2570');
  ok(yearOf('6601001', 2569) === '2' && yearOf('6601001', 2568) === '1', 'earlier years stay on record');
  ok(yearOf('6601005', 2570) === '' && sql(`select "isActive" from "User" where username = '6601005'`) === 'f', 'the graduate has no 2570 record and the account is disabled');
  await pf.locator('button[type=submit]').click();
  await ap.waitForFunction(() => /already recorded 7/.test(document.querySelector('[data-testid=promote-form] [role=status]')?.textContent || ''));
  ok(sql(`select count(*) from "CadetYear" where "academicYear" = 2570`) === '7', 'running the promotion again changes nothing');
  ok(sql(`select count(*) from "AuditLog" where action = 'user.promoted'`) === '2', 'promotions are audited');
  await ap.screenshot({ path: S + '/yl-promote.png' });
  await ap.keyboard.press('Escape');

  // A cadet sees their own year level.
  const cp = await firstLogin('6601001', 'Cadet1Pass9');
  await cp.goto(B + '/account');
  ok(/Year 2/.test(await cp.getByTestId('my-year').innerText()), 'cadet account page shows the year level');

  // ---------- Instructor: switches, lists, copy dialog, confirm dialog ----------
  const tp = await firstLogin('T0001', 'Teach3rPass');
  const [sec1, sec2] = sql(`select o.id from "CourseOffering" o join "Course" c on c.id = o."courseId" where c.code = 'CS201' order by o.section`).split('\n');

  await tp.goto(`${B}/courses/${sec1}/assignments`);
  const rows = tp.getByTestId('assignment-row');
  ok(await rows.count() === 2 && /3\/5/.test(await rows.first().innerText()), 'assignment cards show how many have handed in');
  const box = await rows.first().boundingBox();
  await tp.mouse.click(box.x + box.width / 2, box.y + box.height - 6);
  await tp.waitForURL(/assignments\/[a-z0-9]+$/);
  ok(true, 'clicking anywhere on an assignment card opens it');

  // Copy dialog: names the item, shows the other section with its instructor and cadet count.
  await tp.getByTestId('assignment-more').click(); await tp.getByTestId('copy-assignment').click();
  const cf = tp.getByTestId('copy-form');
  const ct = await cf.innerText();
  ok(/Lab 3/.test(ct) && /Sec 2/.test(ct) && /Demo Instructor/.test(ct) && /2 cadets/.test(ct), 'copy dialog names the assignment and describes the target section');
  ok(/Not copied/.test(ct) && /Submissions/.test(ct) && /separate copy/.test(ct), 'copy dialog says what is not copied and that copies are separate');
  ok(await cf.locator('input[name=target]').isChecked(), 'the only other section is preselected');
  await cf.locator('button[type=submit]').click();
  await tp.waitForFunction(() => !document.querySelector('dialog[open]'));
  ok(/Sec 2/.test(await tp.getByTestId('toaster').innerText()), 'copying confirms with a toast');
  ok(sql(`select count(*) from "Assignment" where "offeringId" = '${sec2}' and title like 'Lab 3%'`) === '1', 'the assignment exists in section 2');
  await tp.screenshot({ path: S + '/ux-assignment.png' });

  // Switches in the assignment form.
  await tp.getByTestId('assignment-more').click(); await tp.getByTestId('edit-assignment').click();
  const sw = tp.locator('dialog[open] input.toggle[role=switch]');
  ok(await sw.count() === 4, 'on/off settings are switches');
  ok(await tp.locator('dialog[open] input[name=allowLate]').evaluate((e) => getComputedStyle(e).appearance === 'none' && e.offsetWidth >= 34), 'switches are drawn as switches, not ticks');
  await tp.screenshot({ path: S + '/ux-switches.png' });
  await tp.keyboard.press('Escape');
  await tp.waitForFunction(() => !document.querySelector('dialog[open]'));

  // Confirm dialog instead of the browser's confirm().
  let native = false; tp.on('dialog', (d) => { native = true; d.accept(); });
  await tp.goto(`${B}/courses/${sec2}/assignments`);
  await tp.getByTestId('assignment-row').first().locator('a').first().click();
  await tp.waitForURL(/assignments\/[a-z0-9]+$/);
  await tp.getByTestId('assignment-more').click(); await tp.getByTestId('delete-assignment').click();
  const cd = tp.getByTestId('confirm-dialog');
  ok(await cd.isVisible() && !native, 'deleting asks in an in-page dialog');
  await cd.getByTestId('confirm-cancel').click();
  await tp.waitForFunction(() => !document.querySelector('[data-testid=confirm-dialog]'));
  ok(sql(`select count(*) from "Assignment" where "offeringId" = '${sec2}'`) === '1', 'Cancel keeps the assignment');
  await tp.getByTestId('assignment-more').click(); await tp.getByTestId('delete-assignment').click();
  await tp.getByTestId('confirm-ok').click();
  await tp.waitForURL(new RegExp(`/courses/${sec2}/assignments$`));
  ok(sql(`select count(*) from "Assignment" where "offeringId" = '${sec2}'`) === '0', 'confirming deletes it');

  // Material: visible is a switch; delete asks first.
  await tp.goto(`${B}/courses/${sec1}`);
  await tp.getByTestId('add-material').click();
  const md = tp.locator('dialog[open]');
  await md.locator('[role=tab]').nth(1).click();
  ok(await md.locator('input[name=isPublished].toggle').count() === 1, 'material form uses a switch for "visible"');
  await md.locator('#title').fill('Switch test link');
  await md.locator('#url').fill('https://example.org/x');
  await md.locator('button[type=submit]').click();
  await tp.getByText('Switch test link').first().waitFor();
  const vis = tp.getByTestId('material-visible').first();
  ok(await vis.getAttribute('aria-checked') === 'true', 'material row has a visible switch, on');
  await vis.click();
  await tp.waitForFunction(() => document.querySelector('[data-testid=material-visible]')?.getAttribute('aria-checked') === 'false');
  ok(sql(`select "isPublished" from "Material" where title = 'Switch test link'`) === 'f', 'switching it off hides the material');
  const mrow = tp.getByTestId('material-row').filter({ hasText: 'Switch test link' });
  ok(await mrow.locator('a').first().evaluate((e) => getComputedStyle(e, '::after').position === 'absolute'), 'the title link covers the whole material row');
  // Open/download, copy and delete sit in the ⋯ menu; delete still asks first.
  ok(await mrow.getByTestId('material-delete').count() === 0 && await mrow.getByTestId('material-download').count() === 0, 'download and delete are not shown on the row itself');
  await mrow.getByTestId('material-more').click();
  ok(await mrow.getByTestId('material-download').getAttribute('href') === 'https://example.org/x', 'the ⋯ menu opens the link');
  await mrow.getByTestId('material-delete').click();
  await tp.getByTestId('confirm-ok').click();
  await tp.waitForFunction(() => ![...document.querySelectorAll('[data-testid=material-row]')].some((r) => r.textContent.includes('Switch test link')));
  ok(sql(`select count(*) from "Material" where title = 'Switch test link'`) === '0', 'deleting from the ⋯ menu removes the material');
  // Cadets in the course, grouped by year level and programme.
  const groups = await tp.getByTestId('course-cadets').getByTestId('cadet-group').allInnerTexts();
  ok(groups.length >= 1 && groups.every((g) => /(Year \d|No year level) · \S/.test(g)), 'cadet list says each group\'s year level and programme: ' + groups.join(' | '));

  // Quiz list: the two views are buttons on the card; results has a summary and the big tabs.
  await tp.goto(`${B}/courses/${sec1}/quizzes`);
  ok(await tp.getByTestId('quiz-row').count() === 2, 'quiz cards listed');
  await tp.getByTestId('row-results').first().click();
  await tp.waitForURL(/results$/);
  ok(await tp.getByTestId('results-summary').isVisible() && await tp.getByTestId('quiz-tab-results').getAttribute('aria-current') === 'page', 'Results opens straight from the card, with a summary');
  await tp.getByTestId('quiz-tab-questions').click();
  await tp.waitForURL(/quizzes\/[a-z0-9]+$/);
  ok(await tp.getByTestId('quiz-tab-questions').getAttribute('aria-current') === 'page' && await tp.getByTestId('add-question').isVisible(), 'tabs switch between questions and results');
  await tp.screenshot({ path: S + '/ux-quiz.png' });

  // ---------- Admin: delete a section ----------
  await ap.goto(`${B}/admin/offerings/${sec2}`);
  await ap.getByTestId('delete-offering').click();
  const df = ap.getByTestId('delete-offering-form');
  ok(/People enrolled/.test(await df.innerText()), 'delete dialog lists what the section holds');
  await df.locator('input[name=confirm]').fill('CS999');
  await df.locator('button[type=submit]').click();
  await df.locator('[role=alert]').waitFor();
  ok(sql(`select count(*) from "CourseOffering" where id = '${sec2}'`) === '1', 'a wrong course code does not delete');
  await df.locator('input[name=confirm]').fill('cs201');
  await df.locator('button[type=submit]').click();
  await ap.waitForURL(/\/admin\/courses/);
  ok(sql(`select count(*) from "CourseOffering" where id = '${sec2}'`) === '0', 'typing the course code deletes the section');
  ok(sql(`select count(*) from "Enrollment" where "offeringId" = '${sec2}'`) === '0' && sql(`select count(*) from "Course" where code = 'CS201'`) === '1', 'its roster is gone, the course stays');
  ok(sql(`select details->>'course' from "AuditLog" where action = 'offering.deleted'`) === 'CS201', 'deleting a section is audited');
  await tp.goto(`${B}/courses/${sec2}`);
  ok(/404|not found/i.test(await tp.locator('body').innerText()), 'the deleted section\'s page is gone');

  // ---------- Light theme is not glaring white ----------
  const lp = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    await ctx.addCookies([{ name: 'theme', value: 'light', url: B }]);
    const p = await ctx.newPage();
    await p.goto(B + '/login'); await p.fill('#username', 'T0001'); await p.fill('#password', 'Teach3rPass');
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  })();
  const lum = (rgb) => { const [r, g, b] = rgb.match(/\d+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
  const bg = await lp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const card = await lp.locator('.card, [data-testid=course-card]').first().evaluate((e) => getComputedStyle(e).backgroundColor).catch(() => bg);
  ok(lum(bg) < 0.93 && lum(card) < 0.97, `light theme uses soft greys, not pure white (${bg}, ${card})`);
  await lp.screenshot({ path: S + '/ux-light.png' });

  await browser.close();
  console.log('ALL OK');

  function getComputedAnim(loc) { return loc.evaluate((e) => getComputedStyle(e).animationName); }
})().catch((e) => { console.error(e); process.exit(1); });
