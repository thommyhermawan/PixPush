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
['index.html', 'app.css', 'privacy.html', 'manifest.webmanifest', 'sw.js', 'js', 'icons', 'fonts'].forEach(copy);

let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');

// PeerJS: use the bundled copy instead of the CDN
const peer = path.join(root, 'node_modules/peerjs/dist/peerjs.min.js');
if (fs.existsSync(peer)) {
  fs.mkdirSync(path.join(out, 'js/vendor'), { recursive: true });
  fs.copyFileSync(peer, path.join(out, 'js/vendor/peerjs.min.js'));
  html = html.replace(/<script src="https:\/\/unpkg\.com\/peerjs@[^"]+"/, '<script src="js/vendor/peerjs.min.js"');
  console.log('bundled peerjs');
} else console.warn('peerjs not installed, keeping CDN link');

// The native app does not need the web install manifest or service worker
html = html.replace(/<link rel="manifest"[^>]*>\s*/, '');
fs.rmSync(path.join(out, 'sw.js'), { force: true });

fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('www ready');
