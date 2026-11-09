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

module.exports = { ROOT, OUT, FIXTURES, BASE, DEMO_PASSWORD, PW, sql, dbUrl };
