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

// Protect the two non-negotiable reader elements against accidental visual refactors.
const protectedReaderMarkers = [
  'id="rnHtmlReader"',
  'src="/runa-logo-slide7.svg"',
  'PENGINGAT · QS. AL-INSYIRAH 5–6',
  'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',
  'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
  '“Maka sesungguhnya bersama kesulitan itu ada kemudahan.”',
  '“Sesungguhnya bersama kesulitan itu ada kemudahan.”',
  '.rn-html-reader{position:fixed;inset:0;',
  '.rn-html-reader-main{flex:1;min-height:0;overflow:auto;'
];
for (const marker of protectedReaderMarkers) {
  if (!html.includes(marker)) {
    console.error('Build failed: protected RuNa reader element is missing: ' + marker);
    process.exit(1);
  }
}

// Parse-check the existing frontend renderer and API handlers during every build.
const { spawnSync } = require('node:child_process');
const javascriptFiles = [
  'public/runa-handout-renderer.js',
  'api/generate-content.js',
  'api/content.js'
];
for (const file of javascriptFiles) {
  if (!fs.existsSync(path.join(root, file))) continue;
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) {
    console.error('Build failed: JavaScript syntax check failed for ' + file);
    if (check.stderr) process.stderr.write(check.stderr);
    process.exit(check.status || 1);
  }
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
