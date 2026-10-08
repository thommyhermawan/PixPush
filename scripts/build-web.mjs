// Copies the web game into www/ for the native app, bundling PeerJS and fonts so the app works offline.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const copy = (rel) => {
  const src = path.join(root, rel), dst = path.join(out, rel);
  fs.cpSync(src, dst, { recursive: true });
};
['index.html', 'app.css', 'privacy.html', 'manifest.webmanifest', 'sw.js', 'js', 'icons'].forEach(copy);

let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');

// PeerJS: use the bundled copy instead of the CDN
const peer = path.join(root, 'node_modules/peerjs/dist/peerjs.min.js');
if (fs.existsSync(peer)) {
  fs.mkdirSync(path.join(out, 'js/vendor'), { recursive: true });
  fs.copyFileSync(peer, path.join(out, 'js/vendor/peerjs.min.js'));
  html = html.replace(/<script src="https:\/\/unpkg\.com\/peerjs@[^"]+"/, '<script src="js/vendor/peerjs.min.js"');
  console.log('bundled peerjs');
} else console.warn('peerjs not installed, keeping CDN link');

// Fonts: use bundled @fontsource files instead of Google Fonts
const fontPkgs = [
  ['@fontsource/pixelify-sans', ['500.css', '700.css']],
  ['@fontsource/nunito', ['500.css', '700.css', '800.css']]
];
let fontCss = '', fontsOk = true;
for (const [pkg, files] of fontPkgs) {
  const dir = path.join(root, 'node_modules', pkg);
  if (!fs.existsSync(dir)) { fontsOk = false; break; }
  const name = pkg.split('/')[1];
  const dstDir = path.join(out, 'fonts', name);
  fs.mkdirSync(dstDir, { recursive: true });
  fs.cpSync(path.join(dir, 'files'), path.join(dstDir, 'files'), { recursive: true });
  for (const f of files) {
    if (!fs.existsSync(path.join(dir, f))) continue;
    // keep only latin subsets to stay small
    let css = fs.readFileSync(path.join(dir, f), 'utf8');
    css = css.replace(/url\(\.\/files\//g, `url(${name}/files/`);
    fontCss += css + '\n';
  }
}
if (fontsOk && fontCss) {
  fs.writeFileSync(path.join(out, 'fonts', 'fonts.css'), fontCss);
  html = html
    .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, '')
    .replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, '<link rel="stylesheet" href="fonts/fonts.css">');
  console.log('bundled fonts');
} else console.warn('fonts not installed, keeping Google Fonts link');

// The native app does not need the web install manifest or service worker
html = html.replace(/<link rel="manifest"[^>]*>\s*/, '');
fs.rmSync(path.join(out, 'sw.js'), { force: true });

fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('www ready');
