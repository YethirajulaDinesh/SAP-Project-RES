// Copies the UI (Fiori webapps and the HTML pages) into gen/srv/app, so that the CAP service
// serves them on SAP BTP as well. Runs after "cds build --production" (see mta.yaml).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const target = path.join(root, 'gen/srv/app');
const PAGES = ['landing', 'dashboard', 'yard', 'shared', 'theme'];   // not "switch": test logins exist only locally

fs.rmSync(target, { recursive: true, force: true });
for (const dir of fs.readdirSync(path.join(root, 'app'))) {
  const src = path.join(root, 'app', dir);
  if (PAGES.includes(dir)) fs.cpSync(src, path.join(target, dir), { recursive: true });
  else if (fs.existsSync(path.join(src, 'webapp')))
    fs.cpSync(path.join(src, 'webapp'), path.join(target, dir, 'webapp'), { recursive: true, filter: f => !f.includes(`${path.sep}test${path.sep}`) && !f.endsWith(`${path.sep}test`) });
}
// eslint-disable-next-line no-console
console.log('UI copied to', path.relative(root, target));
