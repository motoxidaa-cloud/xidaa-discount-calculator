// Run the migration file statement-by-statement via the Supabase Management API.
import fs from 'node:fs';
import path from 'node:path';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || 'ehsivyhydesyluvhcxzn';
const file = path.resolve(process.cwd(), 'supabase', 'migrations', '20261103_init_xidaa_schema.sql');

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const sql = fs.readFileSync(file, 'utf8');
// Split into statements. Safe here: no PL/pgSQL bodies and no ";" inside string literals.
const statements = sql
  .split(/;\s*/)
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Loaded ${statements.length} statements from ${path.basename(file)}`);

let ok = 0;
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i] + ';';
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: stmt }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`FAILED statement ${i + 1} (${res.status}):`);
    console.error(stmt.slice(0, 300));
    console.error(body.slice(0, 1000));
    process.exit(1);
  }
  ok++;
  if (i % 20 === 0 || i === statements.length - 1) {
    console.log(`  applied ${i + 1}/${statements.length}`);
  }
}

console.log(`\nAll ${ok} statements applied successfully.`);
