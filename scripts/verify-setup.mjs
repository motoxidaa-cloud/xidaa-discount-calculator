#!/usr/bin/env node
/**
 * Xidaa Discount Calculator — Supabase integration readiness check.
 *
 * Verifies env configuration, migration state, and seeded reference data
 * using the service-role/secret key (server-side only).
 *
 * Usage:
 *   node scripts/verify-setup.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

function check(name, ok, detail = '') {
  const mark = ok ? 'OK ' : 'FAIL';
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  loadEnvFile();

  const url = (process.env.VITE_SUPABASE_URL ?? '').trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

  console.log('\nXidaa Discount Calculator — Supabase readiness\n');

  const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url);
  const anonOk = anonKey.length > 20;

  let fail = false;
  fail = !check('VITE_SUPABASE_URL set to a valid project URL', urlOk, url || '(empty)') || fail;
  fail = !check('VITE_SUPABASE_ANON_KEY set', anonOk, anonOk ? 'present' : '(missing)') || fail;

  if (!urlOk || !anonOk) {
    console.log('\n  ➜ Add your Supabase URL and anon key to .env (see .env.example) and re-run.');
    process.exit(fail ? 1 : 0);
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } });

  const expectTable = async (table, label, minRows = 0) => {
    try {
      const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
      if (error) {
        fail = !check(`${label} exists (migration applied)`, false, error.message) || fail;
        return;
      }
      const okCount = (count ?? 0) >= minRows;
      fail = !check(`${label} exists (migration applied)`, okCount, `${count} row(s)`) || fail;
    } catch {
      fail = !check(`${label} exists (migration applied)`, false) || fail;
    }
  };

  await expectTable('app_settings', 'app_settings (financial defaults)', 1);
  await expectTable('model_catalog', 'model_catalog (catalogue)', 13);
  await expectTable('battery_catalog', 'battery_catalog (variants)', 3);
  await expectTable('orders', 'orders');
  await expectTable('order_scooter_items', 'order_scooter_items');
  await expectTable('order_battery_items', 'order_battery_items');
  await expectTable('truck_allocations', 'truck_allocations');
  await expectTable('discount_options', 'discount_options');
  await expectTable('discount_recommendations', 'discount_recommendations');
  await expectTable('profitability_snapshots', 'profitability_snapshots');
  await expectTable('audit_logs', 'audit_logs');

  // Settings fetch sanity check.
  try {
    const { data, error } = await client.from('app_settings').select('data').eq('id', 1).single();
    const okSettings = !error && data?.data?.discounts;
    fail = !check('settings readable & shaped correctly', okSettings, error ? error.message : 'present') || fail;
  } catch {
    fail = !check('settings readable & shaped correctly', false) || fail;
  }

  console.log('');
  if (fail) {
    console.log('  Result: issues found — see the FAIL lines above. Run:  node scripts/run-migration-api.mjs');
    process.exit(1);
  }
  console.log('  Result: all checks passed. The app is ready against Supabase.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
