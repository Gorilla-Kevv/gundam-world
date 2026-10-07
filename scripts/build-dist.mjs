import { cpSync, mkdirSync, readdirSync, statSync, existsSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, extname, basename } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const FFMPEG = process.env.FFMPEG || 'C:\\Users\\kevin\\.cache\\ffmpeg-tool\\node_modules\\ffmpeg-static\\ffmpeg.exe';

const SKIP_IMAGES = new Set(['gundam-1.png', 'gundan-3.jpg', 'gundam-2-2.jpeg']);
const VIDEO_KBPS = { 'hero-bg.mp4': { kbps: 2600, crf: 23 }, 'wallpaper.mp4': { kbps: 2000, crf: 23 } };

const bytes = (n) => (n / 1048576).toFixed(2) + ' MB';
const size = (p) => statSync(p).size;

if (!existsSync(FFMPEG)) {
  console.error('ffmpeg not found at ' + FFMPEG + ' — set FFMPEG env var');
  process.exit(1);
}
if (existsSync(dist)) {
  const prev = join(root, 'dist.prev-' + Date.now());
  renameSync(dist, prev);
  console.log('previous dist kept at ' + basename(prev));
}
mkdirSync(dist, { recursive: true });

const targets = [];
const SKIP_DIR = /^dist(\.prev.*)?$|^(node_modules|\.git|scripts|functions|dev|content|images|css|js|info)$/;
const collect = (dir) => {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.test(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p);
    else if (/\.(html|css|js)$/i.test(name)) targets.push(p);
  }
};
collect(root);
for (const sub of ['css', 'js', 'info']) {
  for (const name of readdirSync(join(root, sub))) {
    const p = join(root, sub, name);
    if (statSync(p).isFile() && !targets.includes(p)) targets.push(p);
  }
}
targets.push(join(root, 'index.html'));
for (const p of [...new Set(targets)]) {
  cpSync(p, join(dist, p.slice(root.length + 1)));
}

const out = (rel) => join(dist, rel);
const run = (args) => execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
const videoArgs = (src, dst, opt, w) => [
  '-hide_banner', '-loglevel', 'error', '-y', '-i', src,
  '-vf', `scale='min(${w},iw)':-2,fps=30`, '-an',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(opt.crf),
  '-maxrate', `${opt.kbps}k`, '-bufsize', `${opt.kbps * 2}k`,
  '-movflags', '+faststart', dst,
];

const skipped = [];
const walkImg = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = p.slice(root.length + 1).replace(/\\/g, '/');
    if (statSync(p).isDirectory()) { walkImg(p); continue; }
    if (!/\.(jpe?g|png|webp|gif|mp4)$/i.test(name)) continue;
    if (SKIP_IMAGES.has(name)) { skipped.push(rel); continue; }
    const dst = out(rel);
    mkdirSync(join(dst, '..'), { recursive: true });
    const mb = size(p) / 1048576;
    if (/\.mp4$/i.test(name)) run(videoArgs(p, dst, VIDEO_KBPS[name] ?? { kbps: 1200, crf: 24 }, 1280));
    else if (/\.jpe?g$/i.test(name) && mb > 0.5) {
      run(['-hide_banner', '-loglevel', 'error', '-y', '-i', p, '-vf', "scale='min(1600,iw)':-2", '-q:v', '5', dst]);
    } else if (/\.png$/i.test(name) && mb > 0.9) {
      run(['-hide_banner', '-loglevel', 'error', '-y', '-i', p, '-vf', "scale='min(1200,iw)':-2", dst]);
    } else cpSync(p, dst);
  }
};
walkImg(join(root, 'images'));

if (existsSync(join(root, 'content'))) {
  mkdirSync(join(dist, 'content'), { recursive: true });
  for (const name of readdirSync(join(root, 'content'))) {
    if (name.endsWith('.json')) cpSync(join(root, 'content', name), join(dist, 'content', name));
  }
}

let total = 0;
const scan = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) scan(p);
    else total += size(p);
  }
};
scan(dist);
console.log('dist: ' + bytes(total) + (total > 50 * 1048576 ? '  OVER 50MB LIMIT' : ''));
if (skipped.length) console.log('skipped unreferenced: ' + skipped.join(', '));
