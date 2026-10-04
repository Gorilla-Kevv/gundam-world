import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? '.';
const srcDirs = ['.', 'info'];
const textFiles = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (['dist', 'node_modules', '.git', 'scripts'].includes(e.name)) continue;
      walk(p);
    } else if (/\.(html|css|js)$/.test(e.name)) textFiles.push(p);
  }
};
srcDirs.forEach(walk);

const refs = new Set();
for (const f of textFiles) {
  const txt = readFileSync(f, 'utf8');
  for (const m of txt.matchAll(/["'(]\s*(\.?\/?(?:\.\.\/)?images\/[^"')?\s]+)/g)) {
    refs.add(m[1].replace(/^\.?\//, '').replace(/^\.\.\//, ''));
  }
}

const media = [];
const walkImg = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkImg(p);
    else if (/\.(jpe?g|png|webp|gif|mp4)$/i.test(e.name)) media.push(p);
  }
};
walkImg(join(root, 'images'));

let used = 0, unused = 0, missing = [];
const rows = [];
const refPaths = new Set([...refs].map((r) => r.replace(/^\.\.\//, '').toLowerCase()));
for (const p of media) {
  const rel = relative(root, p).replace(/\\/g, '/');
  const size = statSync(p).size;
  const hit = refPaths.has(rel.toLowerCase());
  rows.push({ rel, kb: Math.round(size / 1024), used: hit });
  if (hit) used += size; else unused += size;
}
for (const r of refs) {
  const p = join(root, r);
  if (!existsSync(p)) missing.push(r);
}
rows.sort((a, b) => b.kb - a.kb);
console.log('REFERENCED ' + rows.filter((r) => r.used).length + ' files / ' + (used / 1048576).toFixed(1) + ' MB');
console.log('UNREFERENCED ' + rows.filter((r) => !r.used).length + ' files / ' + (unused / 1048576).toFixed(1) + ' MB');
console.log('\n-- biggest referenced --');
rows.filter((r) => r.used).slice(0, 12).forEach((r) => console.log(String(r.kb).padStart(7) + ' KB  ' + r.rel));
console.log('\n-- unreferenced --');
rows.filter((r) => !r.used).forEach((r) => console.log(String(r.kb).padStart(7) + ' KB  ' + r.rel));
console.log('\n-- broken links in source --');
missing.forEach((m) => console.log('MISSING ' + m));
