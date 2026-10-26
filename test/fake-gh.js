#!/usr/bin/env node
// Stand-in for the GitHub CLI. Keeps pull requests in the JSON file named by FAKE_GH_STATE.
const fs = require('fs');
const file = process.env.FAKE_GH_STATE;
const db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { prs: [], calls: [] };
const args = process.argv.slice(2);
db.calls.push(args);
const save = () => fs.writeFileSync(file, JSON.stringify(db, null, 2));
const opt = (name) => args[args.indexOf(name) + 1];
const latest = (branch) => db.prs.filter((p) => p.head === branch).pop();

if (args[0] === 'pr' && args[1] === 'view') {
  const pr = latest(args[2]);
  save();
  if (!pr) {
    process.stderr.write(`no pull requests found for branch "${args[2]}"\n`);
    process.exit(1);
  }
  const jq = opt('--jq');
  if (jq.includes('select')) process.stdout.write(pr.state === 'OPEN' ? pr.url + '\n' : '');
  else process.stdout.write(pr.state + '\n');
} else if (args[0] === 'pr' && args[1] === 'create') {
  const pr = { number: db.prs.length + 1, head: opt('--head'), base: opt('--base'), title: opt('--title'), body: opt('--body'), state: 'OPEN' };
  pr.url = `https://github.com/example/repo/pull/${pr.number}`;
  db.prs.push(pr);
  save();
  process.stdout.write(`Creating pull request...\n${pr.url}\n`);
} else if (args[0] === 'pr' && args[1] === 'close') {
  const pr = latest(args[2]);
  if (pr) pr.state = 'CLOSED';
  save();
} else {
  save();
  process.stderr.write('fake gh: unsupported command\n');
  process.exit(1);
}
