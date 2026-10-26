'use strict';

// Review Flow – edit Markdown in Obsidian with a simple review flow on top of git.
// A side panel lists your drafts (branches) and their changed documents, with one main action:
// send for approval (a pull request). Typing in the approved version starts a draft automatically.
// Plain JavaScript, no build step. Desktop only (uses git and the GitHub CLI `gh`).

const obsidian = require('obsidian');
const { Plugin, ItemView, Notice, Modal, Setting, PluginSettingTab, FileSystemAdapter } = obsidian;
const { execFile, spawn } = require('child_process');
const nodePath = require('path');
const fs = require('fs');

const VIEW_TYPE = 'review-flow';
const PR_MAX_AGE = 60000;
const CLEANUP_INTERVAL = 120000;

const DEFAULT_SETTINGS = {
  baseBranch: 'main',
  folders: '',
  branchPrefix: 'draft/',
  language: 'auto',
  gitPath: '',
  ghPath: '',
};

// ---------- Strings ----------

const STRINGS = {
  en: {
    panelTitle: 'Changes',
    showPanel: 'Show changes',
    approvedOption: '📖 Approved version',
    draftOption: (name, waiting) => `✏️ ${name}` + (waiting ? ' · waiting for approval' : ''),
    otherOption: (b) => `⎇ ${b}`,
    noChanges: 'No changes',
    noChangesSub: 'Start typing in a document and a draft is created automatically.',
    otherSub: 'You are looking at a version other than the approved one.',
    draftHeading: (n) => `Draft · ${n} changed ${n === 1 ? 'document' : 'documents'}`,
    draftEmpty: 'Draft · no changes yet',
    notSent: 'Not sent for approval yet.',
    waiting: '⏳ Waiting for approval',
    waitingChanged: '⏳ Waiting for approval · new changes not sent yet',
    send: 'Send for approval',
    sendChanges: 'Send the changes',
    discard: 'Discard draft',
    viewOnGithub: 'View on GitHub',
    retry: 'Try again',
    refresh: 'Refresh',
    busy: 'Working…',
    deleted: 'deleted',
    setupGitTitle: 'Install git',
    setupGitText: 'On a Mac, a window asks to install the command line developer tools: click Install. On Windows, install Git from git-scm.com. Then click Try again.',
    setupGhTitle: 'Install the GitHub tool',
    setupGhText: 'Review Flow uses the GitHub CLI to send changes for approval. Download it, run the installer, then click Try again.',
    setupGhDownload: 'Download GitHub CLI',
    setupLoginTitle: 'Sign in to GitHub',
    setupLoginText: 'Needed once, so you can send changes for approval.',
    setupLoginButton: 'Sign in to GitHub',
    setupCodeText: 'Your code is copied. Paste it on the GitHub page and approve.',
    setupOpenGithub: 'Open GitHub',
    setupWaiting: 'Waiting for you to approve in the browser…',
    setupFailed: 'Sign-in did not finish. Try again.',
    setupDone: 'You are signed in to GitHub.',
    setupRepoTitle: 'Get the documents',
    setupRepoText: 'Which GitHub repository are the documents in? The documents are downloaded into this vault.',
    setupRepoField: 'Repository, for example organisation/documents',
    setupFolderField: 'Folder to edit, for example qms (optional)',
    setupRepoButton: 'Get the documents',
    setupRepoDone: 'The documents are here. Start writing in any of them.',
    errAlreadyRepo: 'This vault is already a git repository.',
    hintImages: 'With the current Obsidian settings, images you paste are not included in the review.',
    hintImagesManual: 'Choose Settings → Files and links → Default location for new attachments → In subfolder under current folder, and turn off Use [[Wikilinks]].',
    fixImages: 'Fix the setting',
    fixedImages: 'Images are now saved in an attachments folder next to the document, with links that show on GitHub.',
    draftCreated: (n) => `A draft was created: ${n}. Your changes stay there until they are approved.`,
    nothingToSend: 'Nothing to send. Make a change first.',
    sendTitle: 'Send for approval',
    sendIntro: 'The documents are sent for review. The changes take effect once they have been approved.',
    fieldTitle: 'What did you change?',
    fieldBody: 'More details (optional)',
    cancel: 'Cancel',
    sent: 'Sent for approval. The change takes effect once it has been approved.',
    resent: 'The changes have been sent.',
    discardConfirm: 'Discard this draft? All changes in it are deleted and any open approval request is closed. This cannot be undone.',
    discarded: 'The draft was discarded.',
    commitMsg: (files) => `Draft: ${files}`,
    prFiles: 'Changed files',
    prFooter: 'Sent with Review Flow for Obsidian.',
    errNoGit: 'Git was not found. Install git, or set its path in the Review Flow settings.',
    errNoGh: 'The GitHub CLI (gh) was not found. Install it from https://cli.github.com and run “gh auth login” once.',
    errGhAuth: 'You are not signed in to GitHub. Open a terminal and run “gh auth login” once.',
    errNotRepo: 'This vault is not inside a git repository.',
    errOffline: 'Could not reach GitHub. Check your connection and try again.',
    errIdentity: 'Git does not know who you are. Run “gh auth setup-git” or set git user.name and user.email.',
    errConflict: 'Could not switch: there are changes that would be overwritten.',
    errNotOnDraft: 'You are not in a draft.',
    errGeneric: (m) => `Something went wrong: ${m}`,
    setBase: 'Approved branch',
    setBaseDesc: 'The branch that holds the approved version, usually “main”.',
    setFolders: 'Folders',
    setFoldersDesc: 'Comma-separated folders (relative to the vault) that are edited and sent for approval. Empty means the whole vault.',
    setPrefix: 'Draft branch prefix',
    setPrefixDesc: 'Draft branches are named <prefix><document>-<date>-<time>.',
    setLanguage: 'Language',
    setLanguageDesc: 'Reload Obsidian after changing.',
    setGit: 'Path to git',
    setGh: 'Path to gh',
    setPathDesc: 'Leave empty to find it automatically.',
  },
  sv: {
    panelTitle: 'Ändringar',
    showPanel: 'Visa ändringar',
    approvedOption: '📖 Godkänd version',
    draftOption: (name, waiting) => `✏️ ${name}` + (waiting ? ' · väntar på godkännande' : ''),
    otherOption: (b) => `⎇ ${b}`,
    noChanges: 'Inga ändringar',
    noChangesSub: 'Börja skriva i ett dokument så skapas ett utkast automatiskt.',
    otherSub: 'Du tittar på en annan version än den godkända.',
    draftHeading: (n) => `Utkast · ${n} ${n === 1 ? 'ändrat dokument' : 'ändrade dokument'}`,
    draftEmpty: 'Utkast · inga ändringar än',
    notSent: 'Inte skickat för godkännande än.',
    waiting: '⏳ Väntar på godkännande',
    waitingChanged: '⏳ Väntar på godkännande · nya ändringar är inte skickade',
    send: 'Skicka för godkännande',
    sendChanges: 'Skicka ändringarna',
    discard: 'Släng utkast',
    viewOnGithub: 'Visa på GitHub',
    retry: 'Försök igen',
    refresh: 'Uppdatera',
    busy: 'Arbetar…',
    deleted: 'borttaget',
    setupGitTitle: 'Installera git',
    setupGitText: 'På Mac visar macOS en ruta om kommandoradsverktyg: klicka på Installera. På Windows: installera Git från git-scm.com. Tryck sedan på Försök igen.',
    setupGhTitle: 'Installera GitHub-verktyget',
    setupGhText: 'Review Flow använder GitHub CLI för att skicka ändringar för godkännande. Ladda ner det, kör installationen och tryck sedan på Försök igen.',
    setupGhDownload: 'Ladda ner GitHub CLI',
    setupLoginTitle: 'Logga in på GitHub',
    setupLoginText: 'Behövs en gång, för att du ska kunna skicka ändringar för godkännande.',
    setupLoginButton: 'Logga in på GitHub',
    setupCodeText: 'Koden är kopierad. Klistra in den på GitHub-sidan och godkänn.',
    setupOpenGithub: 'Öppna GitHub',
    setupWaiting: 'Väntar på att du godkänner i webbläsaren…',
    setupFailed: 'Inloggningen blev inte klar. Försök igen.',
    setupDone: 'Du är inloggad på GitHub.',
    setupRepoTitle: 'Hämta dokumenten',
    setupRepoText: 'Vilket GitHub-repo ligger dokumenten i? Dokumenten hämtas till det här valvet.',
    setupRepoField: 'Repo, till exempel organisation/dokument',
    setupFolderField: 'Mapp som redigeras, till exempel qms (valfritt)',
    setupRepoButton: 'Hämta dokumenten',
    setupRepoDone: 'Dokumenten är här. Börja skriva i vilket som helst av dem.',
    errAlreadyRepo: 'Det här valvet är redan ett git-repo.',
    hintImages: 'Med Obsidians nuvarande inställningar följer bilder du klistrar in inte med till granskningen.',
    hintImagesManual: 'Välj Inställningar → Filer och länkar → Standardplats för nya bilagor → I undermapp under aktuell mapp, och slå av Använd [[wikilänkar]].',
    fixImages: 'Rätta inställningen',
    fixedImages: 'Bilder sparas nu i mappen attachments bredvid dokumentet, med länkar som syns på GitHub.',
    draftCreated: (n) => `Ett utkast skapades: ${n}. Ändringarna stannar där tills de har godkänts.`,
    nothingToSend: 'Inget att skicka. Gör en ändring först.',
    sendTitle: 'Skicka för godkännande',
    sendIntro: 'Dokumenten skickas för granskning. Ändringarna gäller först när de har godkänts.',
    fieldTitle: 'Vad har du ändrat?',
    fieldBody: 'Mer detaljer (valfritt)',
    cancel: 'Avbryt',
    sent: 'Skickat för godkännande. Ändringen gäller när den har godkänts.',
    resent: 'Ändringarna är skickade.',
    discardConfirm: 'Släng utkastet? Alla ändringar i det raderas och en öppen begäran om godkännande stängs. Det går inte att ångra.',
    discarded: 'Utkastet är slängt.',
    commitMsg: (files) => `Utkast: ${files}`,
    prFiles: 'Ändrade filer',
    prFooter: 'Skickat med Review Flow för Obsidian.',
    errNoGit: 'Git hittades inte. Installera git eller ange sökvägen i inställningarna för Review Flow.',
    errNoGh: 'GitHub CLI (gh) hittades inte. Installera från https://cli.github.com och kör ”gh auth login” en gång.',
    errGhAuth: 'Du är inte inloggad på GitHub. Öppna en terminal och kör ”gh auth login” en gång.',
    errNotRepo: 'Det här valvet ligger inte i ett git-repo.',
    errOffline: 'Kunde inte nå GitHub. Kontrollera anslutningen och försök igen.',
    errIdentity: 'Git vet inte vem du är. Kör ”gh auth setup-git” eller ange git user.name och user.email.',
    errConflict: 'Kunde inte byta: det finns ändringar som skulle skrivas över.',
    errNotOnDraft: 'Du är inte i ett utkast.',
    errGeneric: (m) => `Något gick fel: ${m}`,
    setBase: 'Godkänd gren',
    setBaseDesc: 'Grenen som har den godkända versionen, oftast ”main”.',
    setFolders: 'Mappar',
    setFoldersDesc: 'Kommaseparerade mappar (relativt valvet) som redigeras och skickas för godkännande. Tomt betyder hela valvet.',
    setPrefix: 'Prefix för utkastgrenar',
    setPrefixDesc: 'Utkastgrenar får namnet <prefix><dokument>-<datum>-<tid>.',
    setLanguage: 'Språk',
    setLanguageDesc: 'Starta om Obsidian efter ändring.',
    setGit: 'Sökväg till git',
    setGh: 'Sökväg till gh',
    setPathDesc: 'Lämna tomt för att hitta automatiskt.',
  },
};

// ---------- Helpers ----------

class FlowError extends Error {
  constructor(key) {
    super(key);
    this.key = key;
  }
}

function slugify(s) {
  const slug = String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/, '');
  return slug || 'draft';
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function baseName(p) {
  return p.split('/').pop();
}

function safeUrl(url) {
  return /^https:\/\//.test(url || '') ? url : null;
}

// Finds the one-time code and device URL in the output of `gh auth login --web`.
function parseLogin(out) {
  const code = out.match(/\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/);
  const url = out.match(/https:\/\/github\.com\/login\/device\S*/);
  return { code: code ? code[1] : null, url: url ? url[0] : null };
}

function lines(out) {
  return out ? out.split('\n').filter(Boolean) : [];
}

// Parses `git status --porcelain -z` into repo-relative paths.
function parseStatus(out) {
  const tokens = out.split('\0').filter(Boolean);
  const files = [];
  for (let i = 0; i < tokens.length; i++) {
    const code = tokens[i].slice(0, 2);
    files.push(tokens[i].slice(3));
    if (code[0] === 'R' || code[0] === 'C') i++; // the next token is the old path
  }
  return files;
}

function summarize(files) {
  const names = files.map(baseName);
  return names.slice(0, 3).join(', ') + (names.length > 3 ? ` (+${names.length - 3})` : '');
}

// The git or gh binary to run. A custom path is only used when it really points at git or gh,
// so a settings file shipped with a vault cannot make the plugin run another program.
function toolCommand(tool, settings) {
  const custom = tool === 'git' ? settings.gitPath : settings.ghPath;
  const name = custom ? nodePath.basename(custom).toLowerCase() : '';
  return name === tool || name === `${tool}.exe` ? custom : tool;
}

// GUI apps on macOS do not get the shell PATH, so common install locations are added. Prompts are turned off.
function toolEnv() {
  const extra = process.platform === 'win32' ? [] : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
  return {
    ...process.env,
    PATH: [process.env.PATH, ...extra].filter(Boolean).join(nodePath.delimiter),
    GIT_TERMINAL_PROMPT: '0',
    GH_PROMPT_DISABLED: '1',
    GH_NO_UPDATE_NOTIFIER: '1',
  };
}

// Runs git or gh in `cwd`.
function makeExec(getCwd, getSettings) {
  return (tool, args) => {
    const cmd = toolCommand(tool, getSettings());
    const fullArgs = tool === 'git' ? ['-c', 'core.quotePath=false', ...args] : args;
    const env = toolEnv();
    return new Promise((resolve, reject) => {
      execFile(cmd, fullArgs, { cwd: getCwd(), env, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          err.tool = tool;
          err.stderr = String(stderr || '');
          reject(err);
        } else {
          resolve(String(stdout).replace(/\s+$/, ''));
        }
      });
    });
  };
}

// ---------- Git flow (no Obsidian dependencies, tested on its own) ----------

class GitFlow {
  constructor(exec, getSettings, t, getCwd) {
    this.exec = exec;
    this.getSettings = getSettings;
    this.t = t;
    this.getCwd = getCwd;
    this.excluded = ['.obsidian', '.trash'];
  }

  get s() {
    return this.getSettings();
  }

  get base() {
    return this.s.baseBranch;
  }

  git(...args) {
    return this.exec('git', args);
  }

  // Like git(), but returns `fallback` when the command fails.
  async gitOr(fallback, ...args) {
    try {
      return await this.git(...args);
    } catch (e) {
      return fallback;
    }
  }

  gh(...args) {
    return this.exec('gh', args);
  }

  // Folders in scope (vault-relative). Use pathspecs() for git commands.
  paths() {
    const f = this.s.folders.split(',').map((x) => x.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean);
    return f.length ? f : ['.'];
  }

  // The folders in scope, never Obsidian's own config folder or trash (they must not be committed or cleaned).
  pathspecs() {
    return [...this.paths(), ...this.excluded.map((x) => `:(exclude)${x}`)];
  }

  isDraft(branch) {
    return !!branch && branch.startsWith(this.s.branchPrefix);
  }

  // A readable name for a draft branch: the document part without prefix and date.
  draftName(branch) {
    return branch.slice(this.s.branchPrefix.length).replace(/-\d{6}-\d{4}(\d{2})?$/, '');
  }

  // The first missing piece of the setup: 'git', 'gh', 'login' or 'repo'; null when everything is in place.
  async setupStep() {
    for (const [step, check] of [
      ['git', () => this.git('--version')],
      ['gh', () => this.gh('--version')],
      ['login', () => this.gh('auth', 'status', '--hostname', 'github.com')],
      ['repo', () => this.git('rev-parse', '--is-inside-work-tree')],
    ]) {
      try {
        await check();
      } catch (e) {
        return step;
      }
    }
    return null;
  }

  // Turns the vault into a clone of a GitHub repository ("owner/name" or a URL) and returns its default branch.
  // Files already in the vault stay. If anything fails, the vault is left as it was.
  async connect(repo) {
    const input = repo.trim().replace(/\/+$/, '');
    const url = /^[\w.-]+\/[\w.-]+$/.test(input) ? `https://github.com/${input.replace(/\.git$/, '')}.git` : input;
    if (/^https:\/\/github\.com\//.test(url)) await this.gh('auth', 'setup-git', '--hostname', 'github.com');
    const gitDir = nodePath.join(this.getCwd(), '.git');
    if (fs.existsSync(gitDir)) throw new FlowError('errAlreadyRepo');
    try {
      await this.git('init', '-q');
      await this.git('remote', 'add', 'origin', url);
      await this.git('fetch', '-q', 'origin');
      await this.git('remote', 'set-head', 'origin', '--auto');
      const branch = (await this.git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD')).replace(/^origin\//, '');
      await this.git('checkout', '-q', '-B', branch, '--track', `origin/${branch}`);
      return branch;
    } catch (e) {
      fs.rmSync(gitDir, { recursive: true, force: true });
      throw e;
    }
  }

  // Lets git use the GitHub login for https remotes, and gives git a name and a private email
  // (GitHub's noreply address) when none is set.
  async finishSetup() {
    const url = await this.gitOr('', 'remote', 'get-url', 'origin');
    if (/^https:/.test(url)) await this.gh('auth', 'setup-git', '--hostname', 'github.com');
    const name = !!(await this.gitOr('', 'config', 'user.name'));
    const email = !!(await this.gitOr('', 'config', 'user.email'));
    if (name && email) return;
    const user = JSON.parse(await this.gh('api', 'user'));
    if (!name) await this.git('config', 'user.name', user.name || user.login);
    if (!email) await this.git('config', 'user.email', `${user.id}+${user.login}@users.noreply.github.com`);
  }

  async state() {
    const branch = await this.git('branch', '--show-current');
    const changes = parseStatus(await this.git('status', '--porcelain', '-z', '--untracked-files=all', '--', ...this.pathspecs()));
    return { branch, onBase: branch === this.base, isDraft: this.isDraft(branch), changes };
  }

  // Newest first.
  async drafts() {
    return lines(await this.git('branch', '--list', `${this.s.branchPrefix}*`, '--sort=-committerdate', '--format=%(refname:short)'));
  }

  // Vault-relative paths changed in a draft compared with the approved version.
  async filesInDraft(branch) {
    return lines(await this.git('diff', '--name-only', '--relative', `${this.base}...${branch}`, '--', ...this.pathspecs()));
  }

  // Details about the current draft: files changed since the approved version, and whether anything is not uploaded.
  async draftInfo() {
    const st = await this.state();
    const files = [...new Set([...(await this.filesInDraft('HEAD')), ...st.changes])];
    let unpushed = true;
    try {
      unpushed = (await this.git('rev-list', '--count', '@{u}..HEAD')) !== '0';
    } catch (e) {
      // No upstream yet: nothing uploaded.
    }
    return { files, unpushed: unpushed || st.changes.length > 0 };
  }

  // Fetches the latest approved version. Returns false when offline.
  async updateBase() {
    try {
      await this.git('pull', '--ff-only', 'origin', this.base);
      return true;
    } catch (e) {
      return false;
    }
  }

  // The pull request for a branch as { url, state }, or null.
  async prInfo(branch) {
    try {
      const pr = JSON.parse(await this.gh('pr', 'view', branch, '--json', 'url,state'));
      return pr && pr.url ? { url: pr.url, state: pr.state } : null;
    } catch (e) {
      return null;
    }
  }

  async prUrl(branch) {
    const pr = await this.prInfo(branch);
    return pr && pr.state === 'OPEN' ? pr.url : null;
  }

  // Removes local drafts whose pull request has been merged. Returns true if any was removed.
  async cleanupMerged() {
    const current = await this.git('branch', '--show-current');
    let removed = false;
    for (const d of await this.drafts()) {
      if (d === current) continue;
      const pr = await this.prInfo(d);
      if (pr && pr.state === 'MERGED') {
        await this.git('branch', '-D', d);
        removed = true;
      }
    }
    return removed;
  }

  // Starts a draft from the approved version. Uncommitted changes come along into the draft.
  async startDraft(label) {
    const st = await this.state();
    if (!st.onBase) await this.git('switch', this.base);
    if (!st.changes.length) await this.updateBase();
    const name = `${this.s.branchPrefix}${slugify(label)}-${stamp()}`;
    await this.git('switch', '-c', name);
    return name;
  }

  async push(strict) {
    try {
      await this.git('push', '-u', 'origin', 'HEAD');
      return true;
    } catch (e) {
      if (strict) throw e;
      return false;
    }
  }

  // Commits and uploads the changes. Changes made on the approved branch move into a new draft.
  async save() {
    const st = await this.state();
    if (!st.changes.length) return { saved: false, branch: st.branch };
    let created = null;
    if (!st.isDraft) {
      if (!st.onBase) throw new FlowError('errNotOnDraft');
      created = `${this.s.branchPrefix}${slugify(baseName(st.changes[0]).replace(/\.md$/, ''))}-${stamp()}`;
      await this.git('switch', '-c', created);
    }
    await this.git('add', '-A', '--', ...this.pathspecs());
    await this.git('commit', '-m', this.t('commitMsg', summarize(st.changes)));
    const pushed = await this.push(false);
    return { saved: true, created, pushed, branch: created || st.branch };
  }

  // Saves the current draft and switches to `target` (a draft or the approved branch). A draft without changes is removed.
  async switchTo(target) {
    const st = await this.state();
    if (st.changes.length) await this.save();
    const current = await this.git('branch', '--show-current');
    if (current !== target) await this.git('switch', target);
    if (this.isDraft(current) && current !== target && (await this.git('rev-list', '--count', `${this.base}..${current}`)) === '0') {
      await this.git('branch', '-D', current);
      await this.gitOr(null, 'push', 'origin', '--delete', current);
    }
    if (target === this.base) await this.updateBase();
  }

  backToBase() {
    return this.switchTo(this.base);
  }

  // Saves, uploads and opens (or updates) a pull request, then returns to the approved version.
  async publish(title, details) {
    await this.save();
    const st = await this.state();
    if (!st.isDraft) throw new FlowError('nothingToSend');
    const files = await this.filesInDraft('HEAD');
    if (!files.length) throw new FlowError('nothingToSend');
    await this.push(true);
    let url = await this.prUrl(st.branch);
    const updated = !!url;
    if (!url) {
      const body = [details, `${this.t('prFiles')}:\n` + files.map((f) => `- ${f}`).join('\n'), `_${this.t('prFooter')}_`]
        .filter(Boolean).join('\n\n');
      const out = await this.gh('pr', 'create', '--base', this.base, '--head', st.branch, '--title', title, '--body', body);
      url = out.split('\n').pop().trim();
    }
    await this.git('switch', this.base);
    await this.updateBase();
    return { url, updated, branch: st.branch };
  }

  // Deletes the current draft locally and on GitHub, closing any open pull request.
  async discard() {
    const st = await this.state();
    if (!st.isDraft) throw new FlowError('errNotOnDraft');
    await this.git('reset', '--hard', 'HEAD');
    await this.git('clean', '-fd', '--', ...this.pathspecs());
    await this.git('switch', this.base);
    await this.git('branch', '-D', st.branch);
    try {
      if (await this.prUrl(st.branch)) await this.gh('pr', 'close', st.branch, '--delete-branch');
      else await this.git('push', 'origin', '--delete', st.branch);
    } catch (e) {
      // Never uploaded, or offline.
    }
    return st.branch;
  }
}

// ---------- Obsidian UI ----------

class SendModal extends Modal {
  constructor(plugin, defaultTitle, onSubmit) {
    super(plugin.app);
    this.plugin = plugin;
    this.title = defaultTitle;
    this.details = '';
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const t = (k) => this.plugin.t(k);
    const submit = () => {
      if (!this.title.trim()) return;
      this.close();
      this.onSubmit(this.title.trim(), this.details.trim());
    };
    this.titleEl.setText(t('sendTitle'));
    this.contentEl.createEl('p', { text: t('sendIntro') });
    new Setting(this.contentEl).setName(t('fieldTitle')).addText((c) => {
      c.setValue(this.title).onChange((v) => (this.title = v));
      c.inputEl.addClass('review-flow-wide');
      c.inputEl.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
      setTimeout(() => c.inputEl.select(), 0);
    });
    new Setting(this.contentEl).setName(t('fieldBody')).addTextArea((c) => {
      c.onChange((v) => (this.details = v));
      c.inputEl.addClass('review-flow-wide');
      c.inputEl.rows = 4;
    });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t('cancel')).onClick(() => this.close()))
      .addButton((b) => b.setButtonText(t('send')).setCta().onClick(submit));
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ConfirmModal extends Modal {
  constructor(plugin, message, confirmText, onConfirm) {
    super(plugin.app);
    this.plugin = plugin;
    this.message = message;
    this.confirmText = confirmText;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    this.contentEl.createEl('p', { text: this.message });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(this.plugin.t('cancel')).onClick(() => this.close()))
      .addButton((b) =>
        b.setButtonText(this.confirmText).setWarning().onClick(() => {
          this.close();
          this.onConfirm();
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

// The side panel: draft picker, changed documents and the actions.
class ChangesView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return this.plugin.t('panelTitle');
  }

  getIcon() {
    return 'git-pull-request';
  }

  async onOpen() {
    this.render();
  }

  render() {
    const p = this.plugin;
    const t = (k, ...a) => p.t(k, ...a);
    const s = p.state;
    const el = this.contentEl;
    // Keep the repository form as it is while the user types in it.
    const key = s && s.setup ? `${s.setup}|${p.busy}|${!!p.login}|${p.login && p.login.code}` : null;
    if (key && key === this.lastKey) return;
    this.lastKey = key;
    el.empty();
    el.addClass('review-flow-panel');
    if (!s) return;

    if (s.setup) return this.renderSetup(el, s.setup);

    if (s.error) {
      el.createDiv({ cls: 'review-flow-error', text: p.describeError(s.error) });
      this.button(el, t('retry'), () => p.refresh());
      return;
    }

    // Draft picker
    const select = el.createEl('select', { cls: 'dropdown review-flow-select' });
    const option = (value, text) => select.createEl('option', { value, text });
    option(p.settings.baseBranch, t('approvedOption'));
    for (const d of s.drafts) {
      const pr = p.pr(d);
      option(d, t('draftOption', p.flow.draftName(d), pr && pr.state === 'OPEN'));
    }
    if (!s.onBase && !s.isDraft) option(s.branch, t('otherOption', s.branch || '?'));
    select.value = s.branch;
    select.disabled = p.busy;
    select.onchange = () => p.switchTo(select.value);

    if (!s.onBase && !s.isDraft) {
      el.createDiv({ cls: 'review-flow-sub', text: t('otherSub') });
      return;
    }

    if (p.imagesNeedFix()) {
      const hint = el.createDiv({ cls: 'review-flow-hint', text: t('hintImages') });
      if (p.canFixImages()) {
        const fix = hint.createEl('button', { cls: 'review-flow-hint-button', text: t('fixImages') });
        fix.onclick = () => p.fixImages();
      } else {
        hint.createDiv({ text: t('hintImagesManual') });
      }
    }

    const files = s.files;
    if (!files.length) {
      el.createDiv({ cls: 'review-flow-heading', text: s.isDraft ? t('draftEmpty') : t('noChanges') });
      if (!s.isDraft) el.createDiv({ cls: 'review-flow-sub', text: t('noChangesSub') });
    } else {
      el.createDiv({ cls: 'review-flow-heading', text: t('draftHeading', files.length) });
    }

    // Approval status
    const pr = s.isDraft ? p.pr(s.branch) : null;
    const waiting = pr && pr.state === 'OPEN';
    if (s.isDraft && files.length) {
      const status = el.createDiv({ cls: 'review-flow-sub' });
      status.setText(waiting ? t(s.unpushed ? 'waitingChanged' : 'waiting') : t('notSent'));
      if (waiting && safeUrl(pr.url)) {
        status.createSpan({ text: ' · ' });
        status.createEl('a', { text: t('viewOnGithub'), href: safeUrl(pr.url) });
      }
    }

    // Changed documents
    if (files.length) {
      const list = el.createDiv({ cls: 'review-flow-files' });
      for (const f of files) {
        const file = p.app.vault.getAbstractFileByPath(f);
        const item = list.createDiv({ cls: 'review-flow-file tree-item-self is-clickable' });
        item.createSpan({ text: baseName(f).replace(/\.md$/, '') });
        if (!file) {
          item.addClass('is-deleted');
          item.createSpan({ cls: 'review-flow-file-note', text: ` (${t('deleted')})` });
        } else {
          item.onclick = () => p.app.workspace.getLeaf(false).openFile(file);
        }
      }
    }

    // Actions
    if (files.length && (!waiting || s.unpushed)) this.button(el, t(waiting ? 'sendChanges' : 'send'), () => p.send(), true);
    if (s.isDraft) {
      const discard = el.createEl('button', { cls: 'review-flow-link', text: t('discard') });
      discard.disabled = p.busy;
      discard.onclick = () => p.discard();
    }
    if (p.busy) el.createDiv({ cls: 'review-flow-sub', text: t('busy') });
  }

  // First-time setup: one step at a time, with the action for that step.
  renderSetup(el, step) {
    const p = this.plugin;
    const t = (k) => p.t(k);
    const retry = () => p.refresh(true);
    if (step === 'git') {
      el.createDiv({ cls: 'review-flow-heading', text: t('setupGitTitle') });
      el.createDiv({ cls: 'review-flow-sub', text: t('setupGitText') });
      this.button(el, t('retry'), retry, true);
    } else if (step === 'gh') {
      el.createDiv({ cls: 'review-flow-heading', text: t('setupGhTitle') });
      el.createDiv({ cls: 'review-flow-sub', text: t('setupGhText') });
      this.button(el, t('setupGhDownload'), () => window.open('https://cli.github.com'), true);
      this.button(el, t('retry'), retry);
    } else if (step === 'login') {
      el.createDiv({ cls: 'review-flow-heading', text: t('setupLoginTitle') });
      const login = p.login;
      if (!login) {
        el.createDiv({ cls: 'review-flow-sub', text: t('setupLoginText') });
        if (p.loginFailed) el.createDiv({ cls: 'review-flow-error', text: t('setupFailed') });
        this.button(el, t('setupLoginButton'), () => p.startLogin(), true);
      } else if (!login.code) {
        el.createDiv({ cls: 'review-flow-sub', text: t('busy') });
      } else {
        el.createDiv({ cls: 'review-flow-code', text: login.code });
        el.createDiv({ cls: 'review-flow-sub', text: t('setupCodeText') });
        this.button(el, t('setupOpenGithub'), () => p.openLoginPage(), true);
        el.createDiv({ cls: 'review-flow-sub', text: t('setupWaiting') });
      }
    } else if (step === 'repo') {
      const form = p.connectForm;
      el.createDiv({ cls: 'review-flow-heading', text: t('setupRepoTitle') });
      el.createDiv({ cls: 'review-flow-sub', text: t('setupRepoText') });
      const field = (key, placeholder) => {
        const input = el.createEl('input', { type: 'text', cls: 'review-flow-input', attr: { placeholder } });
        input.value = form[key];
        input.disabled = p.busy;
        input.oninput = () => (form[key] = input.value);
        return input;
      };
      field('repo', t('setupRepoField'));
      field('folder', t('setupFolderField'));
      this.button(el, p.busy ? t('busy') : t('setupRepoButton'), () => p.connect(), true);
    }
  }

  button(el, text, onClick, cta) {
    const b = el.createEl('button', { cls: 'review-flow-main' + (cta ? ' mod-cta' : ''), text });
    b.disabled = this.plugin.busy;
    b.onclick = onClick;
    return b;
  }
}

class ReviewFlowPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.busy = false;
    this.quietUntil = 0;
    this.lastCleanup = 0;
    this.state = null;
    this.prCache = new Map();
    this.prLoading = new Set();
    this.flow = new GitFlow(
      makeExec(() => this.vaultPath(), () => this.settings),
      () => this.settings,
      (k, ...a) => this.t(k, ...a),
      () => this.vaultPath()
    );
    this.connectForm = { repo: '', folder: this.settings.folders };
    this.flow.excluded = [this.app.vault.configDir, '.trash'];

    this.registerView(VIEW_TYPE, (leaf) => new ChangesView(leaf, this));

    this.addCommand({ id: 'show', name: this.t('showPanel'), callback: () => this.showPanel() });
    this.addCommand({ id: 'send', name: this.t('send'), callback: () => this.send() });
    this.addCommand({ id: 'discard', name: this.t('discard'), callback: () => this.discard() });
    this.addCommand({ id: 'refresh', name: this.t('refresh'), callback: () => this.refresh() });

    this.addSettingTab(new ReviewFlowSettingTab(this.app, this));

    for (const evt of ['modify', 'create', 'delete', 'rename']) {
      this.registerEvent(this.app.vault.on(evt, (file) => this.onVaultChange(file)));
    }
    this.registerDomEvent(window, 'focus', () => this.refreshSoon());
    this.registerInterval(window.setInterval(() => this.refresh(), 30000));

    this.app.workspace.onLayoutReady(async () => {
      if (!this.app.workspace.getLeavesOfType(VIEW_TYPE).length) await this.showPanel(false);
      this.refresh();
    });
  }

  async showPanel(reveal = true) {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeftLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    if (reveal) this.app.workspace.revealLeaf(leaf);
  }

  lang() {
    if (this.settings.language !== 'auto') return this.settings.language;
    return String(obsidian.moment.locale()).startsWith('sv') ? 'sv' : 'en';
  }

  t(key, ...args) {
    const v = (STRINGS[this.lang()] || STRINGS.en)[key] ?? STRINGS.en[key] ?? key;
    return typeof v === 'function' ? v(...args) : v;
  }

  vaultPath() {
    const a = this.app.vault.adapter;
    return a instanceof FileSystemAdapter ? a.getBasePath() : process.cwd();
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refresh();
  }

  inScope(path) {
    const folders = this.flow.paths();
    return folders.includes('.') || folders.some((f) => path === f || path.startsWith(f + '/'));
  }

  // Obsidian settings that would leave pasted images out of the review: attachments saved outside the
  // folders in scope, or [[wikilinks]] that GitHub does not show. Uses Obsidian's internal config API when present.
  config(key) {
    const vault = this.app.vault;
    return typeof vault.getConfig === 'function' ? vault.getConfig(key) : undefined;
  }

  imagesNeedFix() {
    const folder = this.config('attachmentFolderPath');
    let outside = false;
    if (folder !== undefined && !this.flow.paths().includes('.')) {
      const f = String(folder || '/').replace(/\/+$/, '');
      outside = !(f === '.' || f.startsWith('./') || (f !== '' && this.inScope(`${f}/x`)));
    }
    return outside || this.config('useMarkdownLinks') === false;
  }

  canFixImages() {
    return typeof this.app.vault.setConfig === 'function';
  }

  fixImages() {
    const vault = this.app.vault;
    vault.setConfig('attachmentFolderPath', './attachments');
    vault.setConfig('useMarkdownLinks', true);
    vault.setConfig('newLinkFormat', 'relative');
    new Notice(this.t('fixedImages'), 8000);
    this.render();
  }

  // ----- State -----

  async loadState(recheck) {
    if (recheck || !this.setupChecked) {
      const step = await this.flow.setupStep();
      if (step) return { setup: step };
      this.setupChecked = true;
      try {
        await this.flow.finishSetup();
      } catch (e) {
        console.error('Review Flow setup', e);
      }
    }
    const st = await this.flow.state();
    st.drafts = await this.flow.drafts();
    if (st.isDraft) Object.assign(st, await this.flow.draftInfo());
    else st.files = st.changes;
    return st;
  }

  refreshSoon() {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refresh(), 800);
  }

  async refresh(recheck) {
    if (this.busy) return;
    try {
      this.state = await this.loadState(recheck === true);
    } catch (e) {
      this.state = { error: e };
    }
    this.render();
    if (this.state.onBase && this.state.changes.length && Date.now() >= this.quietUntil) return this.moveToDraft(this.state.changes);
    if (Date.now() - this.lastCleanup > CLEANUP_INTERVAL && this.state && !this.state.error && !this.state.setup) {
      this.lastCleanup = Date.now();
      let removed = false;
      try {
        removed = await this.flow.cleanupMerged();
      } catch (e) {
        // Offline: try again later.
      }
      if (removed) this.refresh();
    }
  }

  render() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof ChangesView) leaf.view.render();
    }
  }

  // Pull request info from a short-lived cache; a stale entry is reloaded in the background.
  pr(branch) {
    const c = this.prCache.get(branch);
    if (!c || Date.now() - c.at > PR_MAX_AGE) this.loadPr(branch);
    return c ? c.info : null;
  }

  async loadPr(branch) {
    if (this.prLoading.has(branch)) return;
    this.prLoading.add(branch);
    try {
      this.prCache.set(branch, { info: await this.flow.prInfo(branch), at: Date.now() });
    } finally {
      this.prLoading.delete(branch);
    }
    this.render();
  }

  // Signs in with `gh auth login --web`: shows the one-time code in the panel and opens GitHub's device page.
  startLogin() {
    if (this.login) return;
    this.loginFailed = false;
    const login = (this.login = { code: null, url: 'https://github.com/login/device' });
    const args = ['auth', 'login', '--web', '--hostname', 'github.com', '--git-protocol', 'https', '--skip-ssh-key'];
    const child = spawn(toolCommand('gh', this.settings), args, { cwd: this.vaultPath(), env: toolEnv() });
    let out = '';
    const onData = (chunk) => {
      out += String(chunk);
      const found = parseLogin(out);
      if (found.url) login.url = found.url;
      if (found.code && !login.code) {
        login.code = found.code;
        this.copy(login.code);
        this.openLoginPage();
        this.render();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', () => {
      this.login = null;
      this.loginFailed = true;
      this.refresh(true);
    });
    child.on('close', async (exitCode) => {
      this.login = null;
      this.loginFailed = exitCode !== 0;
      if (exitCode === 0) new Notice(this.t('setupDone'));
      this.setupChecked = false;
      this.refresh(true);
    });
    this.render();
  }

  // Downloads the documents from the repository given in the panel into this vault.
  connect() {
    const { repo, folder } = this.connectForm;
    if (!repo.trim()) return;
    return this.run(async () => {
      const branch = await this.flow.connect(repo);
      this.settings.baseBranch = branch;
      this.settings.folders = folder.trim();
      await this.saveData(this.settings);
      this.setupChecked = false;
      new Notice(this.t('setupRepoDone'), 8000);
    });
  }

  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // gh has usually copied the code already.
    }
  }

  openLoginPage() {
    if (this.login && safeUrl(this.login.url)) window.open(this.login.url);
  }

  // Changes in the approved version move into a new draft right away (see refresh).
  onVaultChange(file) {
    if (!file || !this.inScope(file.path)) return;
    if (this.busy || Date.now() < this.quietUntil) return; // files change on disk when we switch branches
    this.refreshSoon();
  }

  moveToDraft(changes) {
    const doc = changes.find((f) => f.endsWith('.md')) || changes[0];
    return this.run(async () => {
      const name = await this.flow.startDraft(baseName(doc).replace(/\.md$/, ''));
      new Notice(this.t('draftCreated', this.flow.draftName(name)), 8000);
    });
  }

  // Writes any pending editor changes to disk before git looks at the files.
  async flushEditors() {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      if (leaf.view instanceof obsidian.MarkdownView) await leaf.view.save();
    }
  }

  describeError(e) {
    if (e instanceof FlowError) return this.t(e.key);
    const msg = `${e.stderr || ''} ${e.message || ''}`;
    if (e.code === 'ENOENT') return this.t(e.tool === 'gh' ? 'errNoGh' : 'errNoGit');
    if (/not a git repository/i.test(msg)) return this.t('errNotRepo');
    if (/gh auth login|authentication|not logged|could not read username/i.test(msg)) return this.t('errGhAuth');
    if (/could not resolve host|unable to access|could not read from remote|network/i.test(msg)) return this.t('errOffline');
    if (/tell me who you are|user\.email/i.test(msg)) return this.t('errIdentity');
    if (/would be overwritten|untracked working tree files/i.test(msg)) return this.t('errConflict');
    const line = (e.stderr || e.message || '').trim().split('\n').pop();
    return this.t('errGeneric', line);
  }

  // Runs one action at a time, shows errors in plain language and refreshes afterwards.
  async run(action) {
    if (this.busy) {
      new Notice(this.t('busy'));
      return;
    }
    this.busy = true;
    this.render();
    try {
      await action();
    } catch (e) {
      console.error('Review Flow', e);
      if (this.describeError(e) === this.t('errGhAuth')) this.setupChecked = false; // show the sign-in step again
      new Notice(this.describeError(e), 10000);
    } finally {
      this.busy = false;
      this.quietUntil = Date.now() + 2000;
      await this.refresh();
    }
  }

  // ----- Actions -----

  switchTo(branch) {
    return this.run(async () => {
      await this.flushEditors();
      await this.flow.switchTo(branch);
    });
  }

  send() {
    return this.run(async () => {
      await this.flushEditors();
      const st = await this.flow.state();
      const files = st.isDraft ? (await this.flow.draftInfo()).files : st.changes;
      if (!files.length) return new Notice(this.t('nothingToSend'));
      const doSend = async (title, details) => {
        await this.flushEditors();
        const r = await this.flow.publish(title, details);
        this.prCache.delete(r.branch);
        const frag = createFragment((f) => {
          f.createSpan({ text: this.t(r.updated ? 'resent' : 'sent') + ' ' });
          if (safeUrl(r.url)) f.createEl('a', { text: this.t('viewOnGithub'), href: safeUrl(r.url) });
        });
        new Notice(frag, 15000);
      };
      // Already waiting for approval: just send the latest changes.
      if (st.isDraft && (await this.flow.prUrl(st.branch))) return doSend('', '');
      const title = files.map((f) => baseName(f).replace(/\.md$/, '')).slice(0, 3).join(', ');
      new SendModal(this, title, (ti, d) => this.run(() => doSend(ti, d))).open();
    });
  }

  discard() {
    new ConfirmModal(this, this.t('discardConfirm'), this.t('discard'), () =>
      this.run(async () => {
        await this.flow.discard();
        new Notice(this.t('discarded'));
      })
    ).open();
  }
}

class ReviewFlowSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const p = this.plugin;
    const t = (k) => p.t(k);
    const el = this.containerEl;
    el.empty();
    const text = (key, prop, desc) =>
      new Setting(el).setName(t(key)).setDesc(desc).addText((c) =>
        c.setValue(p.settings[prop]).onChange(async (v) => {
          p.settings[prop] = v.trim();
          await p.saveSettings();
        })
      );
    text('setBase', 'baseBranch', t('setBaseDesc'));
    text('setFolders', 'folders', t('setFoldersDesc'));
    text('setPrefix', 'branchPrefix', t('setPrefixDesc'));
    new Setting(el).setName(t('setLanguage')).setDesc(t('setLanguageDesc')).addDropdown((d) =>
      d.addOptions({ auto: 'Auto', en: 'English', sv: 'Svenska' }).setValue(p.settings.language).onChange(async (v) => {
        p.settings.language = v;
        await p.saveSettings();
      })
    );
    text('setGit', 'gitPath', t('setPathDesc'));
    text('setGh', 'ghPath', t('setPathDesc'));
  }
}

module.exports = ReviewFlowPlugin;
module.exports.default = ReviewFlowPlugin;
Object.assign(module.exports, { GitFlow, FlowError, STRINGS, makeExec, toolCommand, slugify, parseStatus, parseLogin, safeUrl });
