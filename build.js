const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const source = path.join(root, 'index.html');
const outputDir = path.join(root, 'dist');
const output = path.join(outputDir, 'index.html');

if (!fs.existsSync(source)) {
  console.error('Build failed: index.html was not found at the project root.');
  process.exit(1);
}

const html = fs.readFileSync(source, 'utf8');
if (!html.includes('<html') || !html.includes('</html>')) {
  console.error('Build failed: index.html does not look like a complete HTML document.');
  process.exit(1);
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(source, output);

// Publish static assets from /public at the site root (e.g. /fonts/adumu.ttf).
const publicDir = path.join(root, 'public');
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, outputDir, { recursive: true });
}

console.log('RuangNalar static prototype and public assets built successfully into dist/.');
