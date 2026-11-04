#!/usr/bin/env node
/**
 * Applies the Supabase SQL migrations in supabase/migrations/.
 *
 * It tries `psql` first (requires a DATABASE_URL / SUPABASE_DB_URL
 * connection string). If psql is unavailable, it prints the SQL files so
 * they can be pasted into the Supabase Dashboard → SQL Editor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* ignore */
  }
}

loadEnvFile();

const dir = path.resolve(process.cwd(), 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const psqlAvailable = (() => {
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

if (dbUrl && psqlAvailable) {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`Applying ${file} ...`);
    execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', path.join(dir, file)], { stdio: 'inherit' });
  }
  console.log('All migrations applied.');
} else {
  console.log('psql/DATABASE_URL not available. Open the Supabase Dashboard → SQL Editor and run:');
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`\n--- ${file} ---\n`);
    console.log(sql.slice(0, 30000));
    if (sql.length > 30000) console.log('... (truncated preview; run the full file in the SQL Editor)');
  }
}
