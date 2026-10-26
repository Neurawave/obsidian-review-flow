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
const { GitFlow, STRINGS, makeExec, slugify, parseStatus, parseLogin, safeUrl } = require('../main.js');

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
  ghPath: path.join(__dirname, 'bin', 'gh'),
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
  assert.deepStrictEqual(
    parseLogin('\n! One-time code (4F2A-9C1B) copied to clipboard\nOpen this URL to continue in your web browser: https://github.com/login/device\n'),
    { code: '4F2A-9C1B', url: 'https://github.com/login/device' }
  );
  assert.deepStrictEqual(parseLogin('Logging in...'), { code: null, url: null });
  assert.strictEqual(safeUrl('https://github.com/x/y/pull/1'), 'https://github.com/x/y/pull/1');
  assert.strictEqual(safeUrl('javascript:alert(1)'), null);
  assert.strictEqual(safeUrl('file:///etc/passwd'), null);
  assert.deepStrictEqual(parseStatus(' M qms/a.md\0?? qms/b c.md\0R  qms/new.md\0qms/old.md\0'), ['qms/a.md', 'qms/b c.md', 'qms/new.md']);
});

test('starts on the approved version', async () => {
  const st = await flow.state();
  assert.deepStrictEqual(st, { branch: 'main', onBase: true, isDraft: false, changes: [] });
});

let draft;

test('Edit creates a draft branch', async () => {
  draft = await flow.startDraft('SOP-001');
  assert.match(draft, /^draft\/sop-001-\d{6}-\d{6}$/);
  assert.strictEqual(flow.draftName(draft), 'sop-001');
  assert.strictEqual((await flow.state()).isDraft, true);
});

test('only files in the configured folders count as changes', async () => {
  write('qms/SOP-001.md', read('qms/SOP-001.md') + '| 3 | 4 |\n');
  write('qms/Rutin för ändring.md', '# Ny rutin\n');
  write('scripts/check.py', 'print("changed")\n');
  const st = await flow.state();
  assert.deepStrictEqual(st.changes.sort(), ['qms/Rutin för ändring.md', 'qms/SOP-001.md']);
});

test('draft info counts changed documents and what is not uploaded', async () => {
  const info = await flow.draftInfo();
  assert.deepStrictEqual(info.files.sort(), ['qms/Rutin för ändring.md', 'qms/SOP-001.md']);
  assert.strictEqual(info.unpushed, true);
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
  assert.strictEqual((await flow.draftInfo()).unpushed, false);
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

test('the sent draft is listed with its pull request', async () => {
  assert.deepStrictEqual(await flow.drafts(), [draft]);
  assert.deepStrictEqual(await flow.filesInDraft(draft), ['qms/Rutin för ändring.md', 'qms/SOP-001.md']);
  assert.deepStrictEqual(await flow.prInfo(draft), { url: 'https://github.com/example/repo/pull/1', state: 'OPEN' });
});

test('Publishing again updates the same pull request', async () => {
  assert.deepStrictEqual(await flow.drafts(), [draft]);
  await flow.switchTo(draft);
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

test('Save and close on an empty draft removes it', async () => {
  const name = await flow.startDraft('tom');
  await flow.backToBase();
  assert.strictEqual((await flow.state()).onBase, true);
  assert.deepStrictEqual(await flow.drafts(), []);
  assert.strictEqual(sh(vault, 'branch', '--list', name), '');
});

test('Save and close keeps a draft with changes', async () => {
  const name = await flow.startDraft('SOP-001');
  write('qms/SOP-001.md', read('qms/SOP-001.md') + 'Pågående.\n');
  await flow.backToBase();
  assert.strictEqual((await flow.state()).onBase, true);
  assert.deepStrictEqual(await flow.drafts(), [name]);
  assert.ok(!read('qms/SOP-001.md').includes('Pågående.'));
  await flow.switchTo(name);
  assert.ok(read('qms/SOP-001.md').includes('Pågående.'));
  await flow.discard();
});

test('switching between drafts saves the one you leave', async () => {
  const a = await flow.startDraft('A');
  write('qms/A.md', 'a\n');
  await flow.switchTo('main');
  write('qms/B.md', 'b\n');
  const b = (await flow.save()).created;
  write('qms/B.md', 'b2\n');
  await flow.switchTo(a);
  assert.strictEqual((await flow.state()).branch, a);
  assert.ok(!fs.existsSync(path.join(vault, 'qms/B.md')));
  await flow.switchTo(b);
  assert.strictEqual(read('qms/B.md'), 'b2\n');
  await flow.discard();
  await flow.switchTo(a);
  await flow.discard();
  assert.deepStrictEqual(await flow.drafts(), []);
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

test('a custom path is only used when it points at git or gh', async () => {
  const run = (gitPath) => makeExec(() => vault, () => ({ gitPath, ghPath: '' }))('git', ['--version']);
  assert.match(await run('/usr/bin/git'), /git version/);
  assert.match(await run('/bin/echo'), /git version/, 'falls back to git instead of running echo');
});

test('with the whole vault in scope, Obsidian config and trash are never committed or cleaned', async () => {
  const saved = settings.folders;
  settings.folders = '';
  try {
    write('.obsidian/workspace.json', '{}\n');
    write('.trash/old.md', 'old\n');
    await flow.switchTo('main');
    const name = await flow.startDraft('whole');
    write('anteckning.md', 'hej\n');
    assert.deepStrictEqual((await flow.state()).changes, ['anteckning.md']);
    await flow.save();
    assert.deepStrictEqual(sh(vault, 'show', '--name-only', '--format=', 'HEAD').split('\n'), ['anteckning.md']);
    write('skräp.md', 'x\n');
    await flow.discard();
    assert.ok(fs.existsSync(path.join(vault, '.obsidian/workspace.json')));
    assert.ok(fs.existsSync(path.join(vault, '.trash/old.md')));
    assert.ok(!fs.existsSync(path.join(vault, 'skräp.md')));
    assert.strictEqual(sh(vault, 'branch', '--list', name), '');
  } finally {
    settings.folders = saved;
  }
});

test('images and attachments inside the folders are saved and sent like documents', async () => {
  await flow.switchTo('main');
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4f50000000049454e44ae426082', 'hex');
  const pdf = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');
  await flow.startDraft('SOP-001');
  fs.mkdirSync(path.join(vault, 'qms/attachments'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'qms/attachments/Pasted image 20261026.png'), png);
  fs.writeFileSync(path.join(vault, 'qms/attachments/Intyg å.pdf'), pdf);
  fs.writeFileSync(path.join(vault, 'Pasted image i roten.png'), png);
  write('qms/SOP-001.md', read('qms/SOP-001.md') + '\n![](attachments/Pasted%20image%2020261026.png)\n');

  const info = await flow.draftInfo();
  assert.deepStrictEqual(info.files.sort(), ['qms/SOP-001.md', 'qms/attachments/Intyg å.pdf', 'qms/attachments/Pasted image 20261026.png']);
  const r = await flow.publish('Bild och intyg', '');
  const pr = gh().prs.filter((x) => x.head === r.branch).pop();
  assert.match(pr.body, /- qms\/attachments\/Pasted image 20261026\.png/);
  assert.match(pr.body, /- qms\/attachments\/Intyg å\.pdf/);
  const committed = sh(vault, '-c', 'core.quotePath=false', 'show', '--name-only', '--format=', r.branch).split('\n').sort();
  assert.deepStrictEqual(committed, ['qms/SOP-001.md', 'qms/attachments/Intyg å.pdf', 'qms/attachments/Pasted image 20261026.png']);
  assert.ok(sh(vault, 'cat-file', '-p', `${r.branch}:qms/attachments/Pasted image 20261026.png`).length > 0);
  assert.ok(fs.existsSync(path.join(vault, 'Pasted image i roten.png')), 'files outside the folders are left alone');
  fs.rmSync(path.join(vault, 'Pasted image i roten.png'));
});

test('first-time setup finds the missing step', async () => {
  assert.strictEqual(await flow.setupStep(), null);
  process.env.FAKE_GH_LOGGED_OUT = '1';
  try {
    assert.strictEqual(await flow.setupStep(), 'login');
  } finally {
    delete process.env.FAKE_GH_LOGGED_OUT;
  }
  const saved = settings.ghPath;
  settings.ghPath = path.join(tmp, 'no-such-dir', 'gh');
  const savedPath = process.env.PATH;
  process.env.PATH = '/nonexistent';
  try {
    assert.strictEqual(await flow.setupStep(), 'gh');
  } finally {
    settings.ghPath = saved;
    process.env.PATH = savedPath;
  }
});

test('after sign-in, git gets a name and the GitHub noreply email when none is set', async () => {
  const clean = path.join(tmp, 'no-identity');
  execFileSync('git', ['clone', '-q', remote, clean]);
  const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = path.join(tmp, 'empty-gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  try {
    const f = new GitFlow(makeExec(() => clean, () => settings), () => settings, t);
    await f.finishSetup();
    assert.strictEqual(sh(clean, 'config', 'user.name'), 'Test Person');
    assert.strictEqual(sh(clean, 'config', 'user.email'), '42+tester@users.noreply.github.com');
    sh(clean, 'config', 'user.name', 'Kept');
    await f.finishSetup();
    assert.strictEqual(sh(clean, 'config', 'user.name'), 'Kept', 'an existing name is kept');
  } finally {
    if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  }
});
