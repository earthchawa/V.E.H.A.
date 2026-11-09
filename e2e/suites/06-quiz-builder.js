const { chromium } = require('playwright');
const fs = require('fs');
const { OUT: S, FIXTURES: F, BASE: B, PW, sql } = require('../lib');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('PASS', m); };
(async () => {
  const browser = await chromium.launch();
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto(B + '/login'); await p.fill('#username', 'T0001'); await p.fill('#password', PW.T0001);
  await p.click('button[type=submit]'); await p.waitForURL(/change-password/);
  await p.fill('#currentPassword', PW.T0001); await p.fill('#newPassword', 'Teach3rPass'); await p.fill('#confirmPassword', 'Teach3rPass');
  await p.click('button[type=submit]'); await p.waitForURL(B + '/');
  await p.locator('ul.grid a', { hasText: 'CS202' }).click(); await p.waitForURL(/courses\/[^/]+$/);
  await p.getByRole('link', { name: 'Quizzes' }).click(); await p.waitForURL(/quizzes$/);
  await p.getByTestId('new-quiz').click();
  await p.fill('#qz-title', 'Pop quiz');
  await p.fill('#qz-limit', '10');
  await p.getByRole('button', { name: 'Create quiz' }).click(); await p.waitForURL(/quizzes\/[^/]+$/);
  ok(true, 'quiz created (draft)');
  // publishing without questions is refused
  await p.getByTestId('quiz-settings').click();
  await p.getByLabel('Visible to cadets').check();
  await p.getByRole('button', { name: 'Save settings' }).click();
  await p.getByText('Add questions before publishing.').waitFor();
  ok(true, 'cannot publish an empty quiz');
  await p.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  // SINGLE via True/False shortcut
  await p.getByTestId('add-question').click();
  await p.locator('dialog[open] textarea[name=prompt]').fill('SQL is a declarative language.');
  await p.getByRole('button', { name: 'True / False' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Add question' }).click();
  await p.getByTestId('builder-question').filter({ hasText: 'SQL is a declarative' }).waitFor();
  // validation: multiple choice without a correct option
  await p.getByTestId('add-question').click();
  await p.locator('dialog[open] select[name=type]').selectOption('MULTIPLE');
  await p.locator('dialog[open] textarea[name=prompt]').fill('Pick the DML statements');
  const opts = p.locator('dialog[open] input[name=optText]');
  await opts.nth(0).fill('SELECT'); await opts.nth(1).fill('CREATE TABLE'); await opts.nth(2).fill('UPDATE'); await opts.nth(3).fill('DROP');
  await p.locator('dialog[open] input[name=optCorrect]').nth(0).uncheck();
  await p.getByRole('dialog').getByRole('button', { name: 'Add question' }).click();
  await p.getByText('Mark at least one correct option.').waitFor();
  ok(await p.locator('dialog[open] textarea[name=prompt]').inputValue() === 'Pick the DML statements', 'validation error keeps the draft');
  await p.locator('dialog[open] input[name=optCorrect]').nth(0).check(); await p.locator('dialog[open] input[name=optCorrect]').nth(2).check();
  await p.locator('dialog[open] input[name=points]').fill('2');
  await p.getByRole('dialog').getByRole('button', { name: 'Add question' }).click();
  await p.getByTestId('builder-question').filter({ hasText: 'Pick the DML' }).waitFor();
  // SHORT
  await p.getByTestId('add-question').click();
  await p.locator('dialog[open] select[name=type]').selectOption('SHORT');
  await p.locator('dialog[open] textarea[name=prompt]').fill('Keyword to remove duplicate rows?');
  await p.locator('dialog[open] textarea[name=accepted]').fill('DISTINCT');
  await p.getByRole('dialog').getByRole('button', { name: 'Add question' }).click();
  await p.getByTestId('builder-question').filter({ hasText: 'remove duplicate' }).waitFor();
  ok(await p.getByTestId('builder-question').count() === 3, '3 questions added');
  ok(await p.getByText('Total 4 points').count() === 1, 'total points updated');
  // reorder: buttons, then drag and drop
  await p.getByTestId('builder-question').nth(2).getByRole('button', { name: 'Move up' }).click();
  await p.waitForTimeout(800);
  ok((await p.getByTestId('builder-question').nth(1).textContent()).includes('remove duplicate'), 'reorder with buttons works');
  await p.getByTestId('builder-question').nth(2).dragTo(p.getByTestId('builder-question').nth(0));
  await p.waitForTimeout(1000);
  await p.reload();
  ok((await p.getByTestId('builder-question').nth(0).textContent()).includes('Pick the DML'), 'drag and drop reorder is saved');
  // publish
  await p.getByTestId('quiz-settings').click();
  await p.getByLabel('Visible to cadets').check();
  await p.getByRole('button', { name: 'Save settings' }).click();
  await p.locator('dialog[open]').waitFor({ state: 'hidden' });
  ok((await p.getByTestId('settings-summary').textContent()).includes('✓'), 'settings saved from the modal');
  // gradebook column created
  await p.getByRole('link', { name: 'Grades' }).click(); await p.waitForURL(/grades$/);
  ok(await p.locator('[data-testid=gradebook] th', { hasText: 'Pop quiz' }).count() === 1, 'quiz appears in the gradebook (/4)');
  await p.goto(p.url().replace('/grades', '/quizzes'));
  await p.getByText('Pop quiz').click(); await p.waitForURL(/quizzes\/[^/]+$/);
  await p.screenshot({ path: S + '/q-builder.png', fullPage: true });
  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
