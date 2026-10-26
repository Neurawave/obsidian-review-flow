// Runs the git flow against a real git repository with a local "GitHub" remote and a fake `gh`.
// Run with: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const load = Module._load;
Module._load = function (request, ...rest) {
  return request === 'obsidian' ? new Proxy({}, { get: () => class {} }) : load.call(this, request, ...rest);
};
const { GitFlow, STRINGS, makeExec, slugify, parseStatus } = require('../main.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'review-flow-'));
const remote = path.join(tmp, 'remote.git');
const vault = path.join(tmp, 'vault');
const other = path.join(tmp, 'reviewer');
const ghState = path.join(tmp, 'gh.json');
process.env.FAKE_GH_STATE = ghState;

const sh = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const write = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(vault, rel)), { recursive: true });
  fs.writeFileSync(path.join(vault, rel), text);
};
const read = (rel) => fs.readFileSync(path.join(vault, rel), 'utf8');
const gh = () => JSON.parse(fs.readFileSync(ghState, 'utf8'));
const identity = (dir) => {
  sh(dir, 'config', 'user.name', 'Test');
  sh(dir, 'config', 'user.email', 'test@example.com');
};

const settings = {
  baseBranch: 'main',
  folders: 'qms',
  branchPrefix: 'draft/',
  gitPath: '',
  ghPath: path.join(__dirname, 'fake-gh.js'),
};
const strings = STRINGS.sv;
const t = (k, ...a) => (typeof strings[k] === 'function' ? strings[k](...a) : strings[k]);
const flow = new GitFlow(makeExec(() => vault, () => settings), () => settings, t);

test.before(() => {
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  execFileSync('git', ['clone', '-q', remote, other], { stdio: 'pipe' });
  identity(other);
  fs.mkdirSync(path.join(other, 'qms'));
  fs.mkdirSync(path.join(other, 'scripts'));
  fs.writeFileSync(path.join(other, 'qms', 'SOP-001.md'), '# SOP-001\n\n| A | B |\n|---|---|\n| 1 | 2 |\n');
  fs.writeFileSync(path.join(other, 'scripts', 'check.py'), 'print("ok")\n');
  sh(other, 'add', '-A');
  sh(other, 'commit', '-q', '-m', 'init');
  sh(other, 'push', '-q', 'origin', 'main');
  execFileSync('git', ['clone', '-q', remote, vault]);
  identity(vault);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('helpers', () => {
  assert.strictEqual(slugify('SOP-001 Dokumentstyrning för ÅÄÖ'), 'sop-001-dokumentstyrning-for-aao');
  assert.strictEqual(slugify('!!!'), 'draft');
  assert.deepStrictEqual(parseStatus(' M qms/a.md\0?? qms/b c.md\0R  qms/new.md\0qms/old.md\0'), ['qms/a.md', 'qms/b c.md', 'qms/new.md']);
});

test('starts on the approved version', async () => {
  const st = await flow.state();
  assert.deepStrictEqual(st, { branch: 'main', onBase: true, isDraft: false, changes: [] });
});

let draft;

test('Edit creates a draft branch', async () => {
  draft = await flow.startDraft('SOP-001');
  assert.match(draft, /^draft\/sop-001-\d{6}-\d{4}$/);
  assert.strictEqual(flow.displayName(draft), 'sop-001');
  assert.strictEqual((await flow.state()).isDraft, true);
});

test('only files in the configured folders count as changes', async () => {
  write('qms/SOP-001.md', read('qms/SOP-001.md') + '| 3 | 4 |\n');
  write('qms/Rutin för ändring.md', '# Ny rutin\n');
  write('scripts/check.py', 'print("changed")\n');
  const st = await flow.state();
  assert.deepStrictEqual(st.changes.sort(), ['qms/Rutin för ändring.md', 'qms/SOP-001.md']);
});

test('Save commits and uploads only the folders', async () => {
  const r = await flow.save();
  assert.strictEqual(r.saved, true);
  assert.strictEqual(r.pushed, true);
  assert.strictEqual(r.created, null);
  assert.match(sh(vault, 'log', '-1', '--format=%s'), /^Utkast: /);
  assert.ok(sh(remote, 'branch', '--list', draft));
  assert.match(sh(vault, 'status', '--porcelain'), /scripts\/check\.py/);
  sh(vault, 'checkout', '--', 'scripts/check.py');
  assert.strictEqual((await flow.save()).saved, false);
});

test('Publish opens a pull request and returns to the approved version', async () => {
  const r = await flow.publish('Lägg till rad i SOP-001', 'Ny rad i tabellen.');
  assert.strictEqual(r.updated, false);
  assert.strictEqual(r.url, 'https://github.com/example/repo/pull/1');
  const pr = gh().prs[0];
  assert.strictEqual(pr.head, draft);
  assert.strictEqual(pr.base, 'main');
  assert.strictEqual(pr.title, 'Lägg till rad i SOP-001');
  assert.match(pr.body, /^Ny rad i tabellen\.\n\nÄndrade filer:\n/);
  assert.match(pr.body, /- qms\/Rutin för ändring\.md/);
  const st = await flow.state();
  assert.strictEqual(st.onBase, true);
  assert.ok(!read('qms/SOP-001.md').includes('| 3 | 4 |'), 'approved version is unchanged until merged');
});

test('Publishing again updates the same pull request', async () => {
  assert.deepStrictEqual(await flow.drafts(), [draft]);
  await flow.openDraft(draft);
  write('qms/SOP-001.md', read('qms/SOP-001.md') + '| 5 | 6 |\n');
  const r = await flow.publish('', '');
  assert.strictEqual(r.updated, true);
  assert.strictEqual(r.url, 'https://github.com/example/repo/pull/1');
  assert.strictEqual(gh().prs.length, 1);
  assert.strictEqual(sh(remote, 'rev-parse', draft), sh(vault, 'rev-parse', draft));
});

test('after approval the change reaches the approved version and the draft is cleaned up', async () => {
  sh(other, 'fetch', '-q', 'origin');
  sh(other, 'merge', '-q', '--no-ff', '-m', 'merge', `origin/${draft}`);
  sh(other, 'push', '-q', 'origin', 'main');
  const db = gh();
  db.prs[0].state = 'MERGED';
  fs.writeFileSync(ghState, JSON.stringify(db));

  assert.strictEqual(await flow.updateBase(), true);
  await flow.cleanupMerged();
  assert.deepStrictEqual(await flow.drafts(), []);
  assert.ok(read('qms/SOP-001.md').includes('| 5 | 6 |'));
});

test('Save on the approved version moves the change into a new draft', async () => {
  write('qms/SOP-001.md', read('qms/SOP-001.md') + 'Glömde redigera först.\n');
  const r = await flow.save();
  assert.match(r.created, /^draft\/sop-001-/);
  const st = await flow.state();
  assert.strictEqual(st.branch, r.created);
  assert.strictEqual(sh(vault, 'rev-parse', 'main'), sh(vault, 'rev-parse', 'origin/main'), 'main is untouched');
});

test('Discard throws the draft away, locally and on the remote', async () => {
  const name = (await flow.state()).branch;
  write('qms/Halvfärdig.md', 'skräp\n');
  await flow.discard();
  const st = await flow.state();
  assert.strictEqual(st.onBase, true);
  assert.deepStrictEqual(st.changes, []);
  assert.deepStrictEqual(await flow.drafts(), []);
  assert.strictEqual(sh(remote, 'branch', '--list', name), '');
  assert.ok(!fs.existsSync(path.join(vault, 'qms/Halvfärdig.md')));
});

test('Save works offline and uploads later', async () => {
  sh(vault, 'remote', 'set-url', 'origin', path.join(tmp, 'missing.git'));
  await flow.startDraft('offline');
  write('qms/SOP-001.md', read('qms/SOP-001.md') + 'Offline.\n');
  const r = await flow.save();
  assert.strictEqual(r.saved, true);
  assert.strictEqual(r.pushed, false);
  sh(vault, 'remote', 'set-url', 'origin', remote);
  assert.strictEqual(await flow.push(false), true);
});
