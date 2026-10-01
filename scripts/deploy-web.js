// Publishes dist/ (from `npm run build:web`) to the gh-pages branch, which GitHub Pages serves at
// https://usmcatl.github.io/recycling-app/
const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const remote = execSync('git remote get-url origin', { cwd: root }).toString().trim();
const run = (cmd) => execSync(cmd, { cwd: dist, stdio: 'inherit' });

run('git init -q -b gh-pages');
run('git add -A');
run('git commit -q -m "Deploy web app"');
run(`git push -q -f ${remote} gh-pages`);
console.log('Deployed to gh-pages');
