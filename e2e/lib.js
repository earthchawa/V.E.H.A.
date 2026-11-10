// Shared settings for the end-to-end suites (see e2e/README.md).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(ROOT, '.env')) && process.loadEnvFile) process.loadEnvFile(path.join(ROOT, '.env'));

/** Screenshots and scratch output (gitignored). */
const OUT = process.env.E2E_OUT || path.join(__dirname, '.out');
fs.mkdirSync(OUT, { recursive: true });
/** Synthetic import files and test documents — never real staff or cadet data. */
const FIXTURES = path.join(__dirname, 'fixtures');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
/** Every demo account starts with this password (the runner seeds with DEMO_PASSWORD). */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo-start-2569';
const PW = new Proxy({}, { get: () => DEMO_PASSWORD });

/** psql against the app database (query parameters such as ?schema= are not understood by psql). */
const dbUrl = () => (process.env.DATABASE_URL || '').split('?')[0];
const sql = (q) => execFileSync('psql', [dbUrl(), '-t', '-A', '-c', q]).toString().trim();

/** Answer the in-page confirmation dialog (ConfirmForm) that follows a delete / reset / disable button. */
const confirmOk = async (page) => {
  await page.getByTestId('confirm-ok').click();
  await page.getByTestId('confirm-dialog').waitFor({ state: 'detached' });
};
/** Open "Copy to other sections" (kind: material | assignment | gradebook), copy to every listed section, wait for the toast. */
const copyToSections = async (page, kind) => {
  await page.getByTestId(`copy-${kind}`).first().click();
  const form = page.getByTestId('copy-form');
  for (const box of await form.locator('input[name=target]').all()) await box.check();
  await form.locator('button[type=submit]').click();
  await page.getByTestId('toaster').getByText(/Copied to/).waitFor();
};

module.exports = { ROOT, OUT, FIXTURES, BASE, DEMO_PASSWORD, PW, sql, dbUrl, confirmOk, copyToSections };
