/**
 * Deploy the production build to Supabase Storage (public bucket `web`).
 * Gives a universal URL that opens on any device, while the source code
 * stays private in GitHub.
 *
 * Usage:
 *   node scripts/deploy-storage.mjs
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

loadEnvFile();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const BUCKET = 'web';
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else out.push({ rel, full });
  }
  return out;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.map': 'application/json',
};

// 1. Ensure bucket exists (public).
const { data: bucket, error: bucketError } = await supabase.storage.getBucket(BUCKET);
if (bucketError) {
  const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (createError) {
    console.error('Could not create bucket:', createError.message);
    process.exit(1);
  }
  console.log(`Created public bucket "${BUCKET}"`);
} else if (!bucket.public) {
  const { error: updError } = await supabase.storage.updateBucket(BUCKET, { public: true });
  if (updError) console.warn('Could not make bucket public:', updError.message);
}

// 2. Clear previous deployment.
const { data: existing } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
for (const item of existing ?? []) {
  if (item.id) await supabase.storage.from(BUCKET).remove([item.name]);
}

// 3. Upload all dist files.
const files = walk(DIST_DIR);
let ok = 0;
for (const { rel, full } of files) {
  const ext = path.extname(rel).toLowerCase();
  const body = fs.readFileSync(full);
  const { error } = await supabase.storage.from(BUCKET).upload(rel, body, {
    contentType: MIME[ext] || 'application/octet-stream',
    upsert: true,
  });
  if (error) {
    console.error(`Upload failed: ${rel} — ${error.message}`);
    process.exit(1);
  }
  ok++;
}

// 4. Print universal URL.
const base = `${url}/storage/v1/object/public/${BUCKET}`;
console.log(`\nUploaded ${ok} files → ${base}`);
console.log(`\nUniversal URL:\n  ${base}/index.html`);
