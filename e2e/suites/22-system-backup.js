// Admin → System: backup download and a real restore from it, file archive, storage info;
// the regrouped similarity settings in the assignment form; optional services stay off without their keys.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const { OUT: S, BASE: B, PW, ROOT, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };

(async () => {
  const browser = await chromium.launch();
  const page = async () => (await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true })).newPage();
  const signIn = async (p, u, pw) => {
    await p.goto(B + '/login'); await p.fill('#username', u); await p.fill('#password', pw);
    await p.click('button[type=submit]'); await p.waitForURL((x) => !x.pathname.startsWith('/login'));
  };
  const firstLogin = async (u, np) => {
    const p = await page(); await signIn(p, u, PW[u]);
    await p.fill('#currentPassword', PW[u]); await p.fill('#newPassword', np); await p.fill('#confirmPassword', np);
    await p.click('button[type=submit]'); await p.waitForURL(B + '/'); return p;
  };
  const sec1 = sql(`select o.id from "CourseOffering" o join "Course" c on c.id = o."courseId" where c.code = 'CS201' order by o.section limit 1`);

  // ---------- Instructor: similarity settings as one group ----------
  const tp = await firstLogin('T0001', 'Teach3rPass');
  await tp.goto(`${B}/courses/${sec1}/assignments`);
  await tp.getByTestId('new-assignment').click();
  const form = tp.locator('dialog[open]');
  const group = form.getByTestId('similarity-settings');
  ok(await group.locator('input[name=ignoreCommon]').isVisible() && await group.locator('#a-vis').isVisible() && await group.locator('#a-base').isVisible(),
    'similarity options sit together under the similarity switch');
  await form.locator('#a-title').fill('Group test');
  await group.locator('#a-base').fill('starter kept');
  await group.locator('input[name=checkSimilarity]').uncheck();
  ok(!(await group.locator('input[name=ignoreCommon]').isVisible()) && !(await group.locator('#a-base').isVisible()), 'they are hidden while checking is off');
  await form.locator('button[type=submit]').click();
  await tp.waitForURL(/assignments\/[a-z0-9]+$/);
  ok(sql(`select "checkSimilarity", "ignoreCommon", "baseText" from "Assignment" where title = 'Group test'`) === 'f|t|starter kept', 'hidden options keep their values when the form is saved');
  ok(await tp.getByTestId('add-reference-ai').count() === 0 && await tp.getByTestId('reference-library').count() === 0, 'no reference library (or AI button) while checking is off');
  await tp.goto(`${B}/courses/${sec1}/assignments`);
  await tp.getByTestId('assignment-row').filter({ hasText: 'Lab 3' }).locator('a').first().click();
  await tp.waitForURL(/assignments\/[a-z0-9]+$/);
  ok(await tp.getByTestId('reference-library').count() === 1 && await tp.getByTestId('add-reference-ai').count() === 0, 'AI answers are not offered without an API key');
  await tp.screenshot({ path: S + '/sys-assignment.png' });

  // A file to back up.
  await tp.goto(`${B}/courses/${sec1}`);
  await tp.getByTestId('add-material').click();
  await tp.locator('dialog[open] #title').fill('Backup me');
  const bytes = Buffer.from('backup-bytes-ทดสอบ '.repeat(400));
  await tp.locator('dialog[open] input[type=file]').setInputFiles({ name: 'สไลด์.txt', mimeType: 'text/plain', buffer: bytes });
  await tp.locator('dialog[open] button[type=submit]').click();
  await tp.getByText('Backup me').first().waitFor();
  ok(await tp.getByTestId('upload-progress').count() === 0, 'without Blob storage files are posted with the form as before');

  // Only admins reach the backup; the direct-upload token route is off without Blob.
  ok((await tp.context().request.get(B + '/api/admin/backup')).status() === 404, 'an instructor cannot download a backup');
  ok((await tp.context().request.get(B + '/api/admin/backup/files')).status() === 404, 'nor the file archive');
  ok((await tp.context().request.post(B + '/api/blob/upload', { data: { type: 'blob.generate-client-token', payload: { pathname: 'u/x/y', multipart: false, clientPayload: null } } })).status() === 404,
    'the direct-upload token route is off without Blob storage');

  // ---------- Admin: System page ----------
  const ap = await firstLogin('admin', 'Adm1nPass99');
  await ap.getByTestId('desktop-nav').getByRole('link', { name: 'System' }).click();
  await ap.waitForURL(/admin\/system$/);
  const storage = await ap.getByTestId('storage-card').innerText();
  ok(/This server's disk/.test(storage) && /50 MB/.test(storage), 'storage card shows where files go and the upload limit');
  ok((await ap.getByTestId('services-card').innerText()).match(/Off/g).length === 3, 'optional services (Blob, AI answers, email) show as off');
  ok(/No backup has been downloaded yet/.test(await ap.getByTestId('last-backup').innerText()), 'no backup yet');
  await ap.screenshot({ path: S + '/sys-page.png', fullPage: true });

  const save = async (testId, name) => {
    const [d] = await Promise.all([ap.waitForEvent('download'), ap.getByTestId(testId).click()]);
    const file = path.join(S, name); await d.saveAs(file); return { file, suggested: d.suggestedFilename() };
  };
  const dbBackup = await save('download-backup', 'e2e-backup.ndjson.gz');
  ok(/^veha-backup-\d{8}-\d{4}\.ndjson\.gz$/.test(dbBackup.suggested), 'backup file name carries the date: ' + dbBackup.suggested);
  const lines = zlib.gunzipSync(fs.readFileSync(dbBackup.file)).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
  const head = lines[0];
  ok(head.format === 'veha-backup' && head.version === 1 && /^\d{14}_/.test(head.migration), 'backup starts with a header (format, version, migration)');
  ok(head.tables.includes('User') && head.tables.includes('Grade') && head.tables.includes('CadetYear') && head.tables.includes('_ExamNetworkToQuiz'), 'every data table is listed');
  ok(!head.tables.includes('Session') && !head.tables.includes('PasswordResetToken') && !head.tables.includes('_prisma_migrations'), 'sessions, reset tokens and the migration table are left out');
  const rowsOf = (t) => lines.filter((l) => l.t === t).flatMap((l) => l.rows);
  ok(rowsOf('User').length === Number(sql(`select count(*) from "User"`)) && rowsOf('Submission').length === Number(sql(`select count(*) from "Submission"`)), 'row counts match the database');
  ok(rowsOf('User').every((u) => typeof u.passwordHash === 'string' && u.passwordHash.startsWith('$2')), 'accounts come with their password hashes (needed for a restore)');

  const files = await save('download-files', 'e2e-files.tar');
  const tar = fs.readFileSync(files.file);
  const entries = [];
  for (let off = 0; off + 512 <= tar.length;) {
    const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/, ''); if (!name) break;
    const size = parseInt(tar.toString('ascii', off + 124, off + 135), 8);
    entries.push({ name, body: tar.subarray(off + 512, off + 512 + size) }); off += 512 + Math.ceil(size / 512) * 512;
  }
  const key = sql(`select "storageKey" from "Material" where title = 'Backup me'`);
  const manifest = JSON.parse(entries.find((e) => e.name === 'manifest.json').body.toString('utf8'));
  ok(manifest.files.some((f) => f.key === key && f.name === 'สไลด์.txt' && f.kind === 'material'), 'the archive manifest maps storage keys to original names');
  ok(entries.find((e) => e.name === 'files/' + key).body.equals(bytes), 'the archive holds the uploaded file byte for byte');

  await ap.reload();
  ok(/Last downloaded .* by System Administrator/.test(await ap.getByTestId('last-backup').innerText()), 'the page shows when a backup was last downloaded');
  ok(sql(`select count(*) from "AuditLog" where action = 'backup.downloaded'`) === '2', 'backup downloads are audited');

  // ---------- A real restore: change things, restore the backup over them, everything is back ----------
  const fingerprint = () => ['User', 'Assignment', 'Submission', 'Grade', 'CadetYear', 'Material', 'Enrollment', 'QuizQuestion']
    .map((t) => sql(`select '${t}:' || count(*) || ':' || md5(coalesce(string_agg(x, '|' order by x), '')) from (select row_to_json(t)::text x from "${t}" t) q`)).join(' ');
  const before = fingerprint();
  sql(`delete from "Grade"`); sql(`delete from "Assignment" where title like 'Lab 3%'`); sql(`update "User" set "fullName" = 'Changed' where username = '6601001'`);
  ok(fingerprint() !== before, 'data changed after the backup');
  const run = (args) => { try { return execFileSync('npx', ['tsx', 'scripts/restore-backup.ts', ...args], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }); } catch (e) { return String(e.stdout) + String(e.stderr); } };
  ok(/already has \d+ accounts/.test(run([dbBackup.file])), 'restore refuses a database that is in use unless --wipe is given');
  ok(/Database restored/.test(run([dbBackup.file, '--wipe'])), 'restore --wipe runs');
  ok(fingerprint() === before, 'after the restore every table is exactly as it was in the backup');
  ok(sql(`select count(*) from "Session"`) === '0', 'sign-in sessions are gone after a restore');
  const again = await page(); await signIn(again, 'T0001', 'Teach3rPass');
  ok(again.url() === B + '/', 'people sign in again with the password they had at backup time');

  await browser.close();
  console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
