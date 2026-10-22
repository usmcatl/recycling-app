// Post-processes `expo export -p web` output in dist/ for GitHub Pages:
//  - adds "Add to Home Screen" support for iPhone (apple-touch-icon, standalone mode)
//  - adds a web app manifest so Android/Chrome can install it too
//  - copies index.html to 404.html so deep links like /status/123 load the app
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const base = require(path.join(root, 'app.json')).expo.experiments.baseUrl || '';

fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(dist, 'app-icon.png'));

fs.writeFileSync(
  path.join(dist, 'manifest.json'),
  JSON.stringify(
    {
      name: 'Recycle Connect',
      short_name: 'Recycle',
      start_url: `${base}/`,
      scope: `${base}/`,
      display: 'standalone',
      background_color: '#f8faf8',
      theme_color: '#004e49',
      icons: [{ src: `${base}/app-icon.png`, sizes: '1024x1024', type: 'image/png', purpose: 'any' }],
    },
    null,
    2,
  ),
);

const head = [
  `<link rel="manifest" href="${base}/manifest.json">`,
  `<link rel="apple-touch-icon" href="${base}/app-icon.png">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="apple-mobile-web-app-title" content="Recycle">',
  '<meta name="theme-color" content="#004e49">',
].join('\n');

const indexPath = path.join(dist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `${head}\n</head>`);
fs.writeFileSync(indexPath, html);
fs.copyFileSync(indexPath, path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

console.log(`Web build ready in dist/ (base ${base || '/'})`);
