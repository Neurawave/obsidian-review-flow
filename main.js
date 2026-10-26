'use strict';

// Review Flow – edit Markdown in Obsidian with a simple review flow on top of git.
// Each note in scope gets a bar with one main action: Edit → Publish (pull request for approval).
// Plain JavaScript, no build step. Desktop only (uses git and the GitHub CLI `gh`).

const obsidian = require('obsidian');
const { Plugin, Notice, Modal, Setting, PluginSettingTab, MarkdownView, FileSystemAdapter } = obsidian;
const { execFile } = require('child_process');
const nodePath = require('path');

const DEFAULT_SETTINGS = {
  baseBranch: 'main',
  folders: '',
  branchPrefix: 'draft/',
  language: 'auto',
  lockBase: true,
  gitPath: '',
  ghPath: '',
};

const PR_MAX_AGE = 60000;

// ---------- Strings ----------

const STRINGS = {
  en: {
    edit: 'Edit',
    continueEdit: 'Continue editing',
    publish: 'Publish',
    publishChanges: 'Publish changes',
    saveAndClose: 'Save and close',
    save: 'Save draft',
    discard: 'Discard draft',
    done: 'Done',
    viewOnGithub: 'View on GitHub',
    showApproved: 'Show approved version',
    retry: 'Try again',
    refresh: 'Refresh',
    busy: 'Working…',
    approvedTitle: '📖 Approved version',
    approvedSub: 'This is the version in effect.',
    approvedDraftSub: 'You have a draft with changes to this document.',
    approvedWaitingSub: 'Your change is waiting for approval.',
    draftTitle: (n) => '✏️ Draft' + (n ? ` · ${n} changed ${n === 1 ? 'document' : 'documents'}` : ''),
    draftSub: 'Your changes are saved automatically. They take effect once they have been approved.',
    draftEmptySub: 'Make your changes in the document.',
    waitingTitle: '⏳ Waiting for approval',
    waitingSub: 'If you change more, publish again.',
    otherTitle: (b) => `⎇ ${b}`,
    otherSub: 'You are looking at a version other than the approved one.',
    errorTitle: '⚠ Review Flow cannot work here',
    locked: 'This is the approved version. Click Edit to make changes.',
    nothingToSave: 'No changes to save.',
    saved: 'Saved.',
    savedLocal: 'Saved on this computer only (no connection). It is uploaded the next time.',
    nothingToPublish: 'Nothing to publish. Make a change first.',
    publishTitle: 'Publish for approval',
    publishIntro: 'Your changes are sent for review. They take effect when they have been approved.',
    fieldTitle: 'What did you change?',
    fieldBody: 'More details (optional)',
    cancel: 'Cancel',
    published: 'Sent for approval. The change shows here once it has been approved.',
    republished: 'The approval request is updated with your latest changes.',
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
    errConflict: 'Could not switch: there are unsaved changes that would be overwritten. Save or discard the draft first.',
    errNotOnDraft: 'You are not in a draft. Click Edit first.',
    errGeneric: (m) => `Something went wrong: ${m}`,
    setBase: 'Approved branch',
    setBaseDesc: 'The branch that holds the approved version, usually “main”.',
    setFolders: 'Folders',
    setFoldersDesc: 'Comma-separated folders (relative to the vault) that are edited and published. Empty means the whole vault.',
    setPrefix: 'Draft branch prefix',
    setPrefixDesc: 'Draft branches are named <prefix><note>-<date>.',
    setLanguage: 'Language',
    setLanguageDesc: 'Reload Obsidian after changing.',
    setLock: 'Read-only approved version',
    setLockDesc: 'Open notes in reading view when you are not in a draft.',
    setGit: 'Path to git',
    setGh: 'Path to gh',
    setPathDesc: 'Leave empty to find it automatically.',
  },
  sv: {
    edit: 'Redigera',
    continueEdit: 'Fortsätt redigera',
    publish: 'Publicera',
    publishChanges: 'Publicera ändringarna',
    saveAndClose: 'Spara och stäng',
    save: 'Spara utkast',
    discard: 'Släng utkast',
    done: 'Klar',
    viewOnGithub: 'Visa på GitHub',
    showApproved: 'Visa godkänd version',
    retry: 'Försök igen',
    refresh: 'Uppdatera',
    busy: 'Arbetar…',
    approvedTitle: '📖 Godkänd version',
    approvedSub: 'Det här är versionen som gäller.',
    approvedDraftSub: 'Du har ett utkast med ändringar i det här dokumentet.',
    approvedWaitingSub: 'Din ändring väntar på godkännande.',
    draftTitle: (n) => '✏️ Utkast' + (n ? ` · ${n} ${n === 1 ? 'ändrat dokument' : 'ändrade dokument'}` : ''),
    draftSub: 'Ändringarna sparas automatiskt. De gäller först när de har godkänts.',
    draftEmptySub: 'Gör dina ändringar i dokumentet.',
    waitingTitle: '⏳ Väntar på godkännande',
    waitingSub: 'Ändrar du mer kan du publicera igen.',
    otherTitle: (b) => `⎇ ${b}`,
    otherSub: 'Du tittar på en annan version än den godkända.',
    errorTitle: '⚠ Review Flow kan inte arbeta här',
    locked: 'Det här är den godkända versionen. Tryck på Redigera för att ändra.',
    nothingToSave: 'Inga ändringar att spara.',
    saved: 'Sparat.',
    savedLocal: 'Sparat bara på den här datorn (ingen anslutning). Laddas upp nästa gång.',
    nothingToPublish: 'Inget att publicera. Gör en ändring först.',
    publishTitle: 'Publicera för godkännande',
    publishIntro: 'Ändringarna skickas för granskning. De gäller först när de har godkänts.',
    fieldTitle: 'Vad har du ändrat?',
    fieldBody: 'Mer detaljer (valfritt)',
    cancel: 'Avbryt',
    published: 'Skickat för godkännande. Ändringen syns här när den har godkänts.',
    republished: 'Begäran om godkännande är uppdaterad med dina senaste ändringar.',
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
    errConflict: 'Kunde inte byta: det finns osparade ändringar som skulle skrivas över. Spara eller släng utkastet först.',
    errNotOnDraft: 'Du är inte i ett utkast. Tryck på Redigera först.',
    errGeneric: (m) => `Något gick fel: ${m}`,
    setBase: 'Godkänd gren',
    setBaseDesc: 'Grenen som har den godkända versionen, oftast ”main”.',
    setFolders: 'Mappar',
    setFoldersDesc: 'Kommaseparerade mappar (relativt valvet) som redigeras och publiceras. Tomt betyder hela valvet.',
    setPrefix: 'Prefix för utkastgrenar',
    setPrefixDesc: 'Utkastgrenar får namnet <prefix><anteckning>-<datum>.',
    setLanguage: 'Språk',
    setLanguageDesc: 'Starta om Obsidian efter ändring.',
    setLock: 'Skrivskyddad godkänd version',
    setLockDesc: 'Öppna anteckningar i läsläge när du inte är i ett utkast.',
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
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function baseName(p) {
  return p.split('/').pop();
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

// Runs git or gh in `cwd`. GUI apps on macOS do not get the shell PATH, so common install locations are added.
function makeExec(getCwd, getSettings) {
  return (tool, args) => {
    const s = getSettings();
    const cmd = tool === 'git' ? (s.gitPath || 'git') : (s.ghPath || 'gh');
    const fullArgs = tool === 'git' ? ['-c', 'core.quotePath=false', ...args] : args;
    const extra = process.platform === 'win32' ? [] : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
    const env = {
      ...process.env,
      PATH: [process.env.PATH, ...extra].filter(Boolean).join(nodePath.delimiter),
      GIT_TERMINAL_PROMPT: '0',
      GH_PROMPT_DISABLED: '1',
      GH_NO_UPDATE_NOTIFIER: '1',
    };
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
  constructor(exec, getSettings, t) {
    this.exec = exec;
    this.getSettings = getSettings;
    this.t = t;
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

  gh(...args) {
    return this.exec('gh', args);
  }

  paths() {
    const f = this.s.folders.split(',').map((x) => x.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean);
    return f.length ? f : ['.'];
  }

  isDraft(branch) {
    return !!branch && branch.startsWith(this.s.branchPrefix);
  }

  async state() {
    const branch = await this.git('branch', '--show-current');
    const changes = parseStatus(await this.git('status', '--porcelain', '-z', '--untracked-files=all', '--', ...this.paths()));
    return { branch, onBase: branch === this.base, isDraft: this.isDraft(branch), changes };
  }

  // Newest first.
  async drafts() {
    return lines(await this.git('branch', '--list', `${this.s.branchPrefix}*`, '--sort=-committerdate', '--format=%(refname:short)'));
  }

  // Vault-relative paths changed in a draft compared with the approved version.
  async filesInDraft(branch) {
    return lines(await this.git('diff', '--name-only', '--relative', `${this.base}...${branch}`, '--', ...this.paths()));
  }

  // Maps each changed file to the newest draft that changes it.
  async draftsByFile() {
    const map = new Map();
    for (const d of await this.drafts()) {
      for (const f of await this.filesInDraft(d)) if (!map.has(f)) map.set(f, d);
    }
    return map;
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

  // Removes local drafts whose pull request has been merged.
  async cleanupMerged() {
    const current = await this.git('branch', '--show-current');
    for (const d of await this.drafts()) {
      if (d === current) continue;
      const pr = await this.prInfo(d);
      if (pr && pr.state === 'MERGED') await this.git('branch', '-D', d);
    }
  }

  async startDraft(label) {
    const st = await this.state();
    if (!st.onBase) await this.git('switch', this.base);
    if (!st.changes.length) await this.updateBase();
    const name = `${this.s.branchPrefix}${slugify(label)}-${stamp()}`;
    await this.git('switch', '-c', name);
    return name;
  }

  async openDraft(name) {
    await this.git('switch', name);
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
    await this.git('add', '-A', '--', ...this.paths());
    await this.git('commit', '-m', this.t('commitMsg', summarize(st.changes)));
    const pushed = await this.push(false);
    return { saved: true, created, pushed, branch: created || st.branch };
  }

  // Saves, uploads and opens (or updates) a pull request, then returns to the approved version.
  async publish(title, details) {
    await this.save();
    const st = await this.state();
    if (!st.isDraft) throw new FlowError('nothingToPublish');
    const files = await this.filesInDraft('HEAD');
    if (!files.length) throw new FlowError('nothingToPublish');
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

  // Leaves the draft (saving it first) and shows the approved version. A draft without changes is removed.
  async backToBase() {
    const st = await this.state();
    if (st.isDraft && st.changes.length) await this.save();
    await this.git('switch', this.base);
    if (st.isDraft && (await this.git('rev-list', '--count', `${this.base}..${st.branch}`)) === '0') {
      await this.git('branch', '-D', st.branch);
      await this.git('push', 'origin', '--delete', st.branch).catch(() => {});
    }
    await this.updateBase();
  }

  // Deletes the current draft locally and on GitHub, closing any open pull request.
  async discard() {
    const st = await this.state();
    if (!st.isDraft) throw new FlowError('errNotOnDraft');
    await this.git('reset', '--hard', 'HEAD');
    await this.git('clean', '-fd', '--', ...this.paths());
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

class PublishModal extends Modal {
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
    this.titleEl.setText(t('publishTitle'));
    this.contentEl.createEl('p', { text: t('publishIntro') });
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
      .addButton((b) => b.setButtonText(t('publish')).setCta().onClick(submit));
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

class ReviewFlowPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.busy = false;
    this.state = null;
    this.prCache = new Map();
    this.prLoading = new Set();
    this.lastLockNotice = 0;
    this.flow = new GitFlow(
      makeExec(() => this.vaultPath(), () => this.settings),
      () => this.settings,
      (k, ...a) => this.t(k, ...a)
    );

    this.addCommand({ id: 'edit', name: this.t('edit'), callback: () => this.edit() });
    this.addCommand({ id: 'publish', name: this.t('publish'), callback: () => this.publish() });
    this.addCommand({ id: 'save-and-close', name: this.t('saveAndClose'), callback: () => this.backToBase() });
    this.addCommand({ id: 'save', name: this.t('save'), callback: () => this.save() });
    this.addCommand({ id: 'discard', name: this.t('discard'), callback: () => this.discard() });
    this.addCommand({ id: 'refresh', name: this.t('refresh'), callback: () => this.refresh() });

    this.addSettingTab(new ReviewFlowSettingTab(this.app, this));

    const layout = () => {
      this.renderBars();
      this.enforceLock();
    };
    this.registerEvent(this.app.workspace.on('layout-change', layout));
    this.registerEvent(this.app.workspace.on('active-leaf-change', layout));
    this.registerEvent(this.app.workspace.on('file-open', layout));
    const soon = () => this.refreshSoon();
    for (const evt of ['modify', 'create', 'delete', 'rename']) this.registerEvent(this.app.vault.on(evt, soon));
    this.registerDomEvent(window, 'focus', soon);
    this.registerInterval(window.setInterval(() => this.refresh(), 30000));

    this.app.workspace.onLayoutReady(() => this.refresh());
  }

  onunload() {
    document.querySelectorAll('.review-flow-bar').forEach((el) => el.remove());
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

  // ----- State -----

  refreshSoon() {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refresh(), 800);
  }

  async loadState() {
    const st = await this.flow.state();
    if (st.isDraft) Object.assign(st, await this.flow.draftInfo());
    else st.fileDrafts = await this.flow.draftsByFile();
    return st;
  }

  async refresh() {
    if (this.busy) return;
    try {
      this.state = await this.loadState();
    } catch (e) {
      this.state = { error: e };
    }
    this.renderBars();
    this.enforceLock();
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
    this.renderBars();
  }

  inScope(path) {
    const folders = this.flow.paths();
    return folders.includes('.') || folders.some((f) => path === f || path.startsWith(f + '/'));
  }

  // ----- The bar above each note -----

  renderBars() {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      let bar = view.containerEl.querySelector(':scope > .review-flow-bar');
      if (!view.file || !this.state || !this.inScope(view.file.path)) {
        if (bar) bar.remove();
        continue;
      }
      if (!bar) {
        bar = createDiv({ cls: 'review-flow-bar' });
        view.containerEl.insertBefore(bar, view.contentEl);
      }
      this.renderBar(bar, view);
    }
  }

  renderBar(bar, view) {
    const s = this.state;
    const t = (k, ...a) => this.t(k, ...a);
    bar.empty();
    bar.className = 'review-flow-bar';
    const text = bar.createDiv({ cls: 'review-flow-text' });
    const actions = bar.createDiv({ cls: 'review-flow-actions' });
    const show = (cls, title, sub) => {
      bar.addClass(cls);
      text.createDiv({ cls: 'review-flow-title', text: title });
      if (sub) text.createDiv({ cls: 'review-flow-sub', text: sub });
    };
    const link = (label, fn) => {
      const b = actions.createEl('button', { cls: 'review-flow-link', text: label });
      b.disabled = this.busy;
      b.onclick = fn;
    };
    const main = (label, fn, disabled) => {
      const b = actions.createEl('button', { cls: 'mod-cta review-flow-main', text: this.busy ? t('busy') : label });
      b.disabled = this.busy || !!disabled;
      b.onclick = fn;
    };
    const open = (url) => () => window.open(url);

    if (s.error) {
      show('is-error', t('errorTitle'), this.describeError(s.error));
      main(t('retry'), () => this.refresh());
      return;
    }

    if (s.isDraft) {
      const pr = this.pr(s.branch);
      const waiting = pr && pr.state === 'OPEN';
      if (waiting && !s.unpushed) {
        show('is-waiting', t('waitingTitle'), t('waitingSub'));
        link(t('viewOnGithub'), open(pr.url));
        link(t('discard'), () => this.discard());
        main(t('done'), () => this.backToBase());
        return;
      }
      show('is-draft', t('draftTitle', s.files.length), t(s.files.length ? 'draftSub' : 'draftEmptySub'));
      if (waiting) link(t('viewOnGithub'), open(pr.url));
      link(t('saveAndClose'), () => this.backToBase());
      link(t('discard'), () => this.discard());
      main(t(waiting ? 'publishChanges' : 'publish'), () => this.publish(), !s.files.length);
      return;
    }

    if (!s.onBase) {
      show('is-other', t('otherTitle', s.branch || '?'), t('otherSub'));
      main(t('showApproved'), () => this.backToBase());
      return;
    }

    const draft = s.fileDrafts.get(view.file.path);
    const pr = draft && this.pr(draft);
    const waiting = pr && pr.state === 'OPEN';
    show('is-approved', t('approvedTitle'), t(!draft ? 'approvedSub' : waiting ? 'approvedWaitingSub' : 'approvedDraftSub'));
    if (waiting) link(t('viewOnGithub'), open(pr.url));
    main(t(draft ? 'continueEdit' : 'edit'), () => this.edit(view));
  }

  // Keeps notes in reading view while the approved version is shown.
  enforceLock() {
    const s = this.state;
    if (!this.settings.lockBase || !s || s.error || s.isDraft) return;
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file || !this.inScope(view.file.path)) continue;
      if (view.getMode() !== 'source') continue;
      this.setMode(view, 'preview');
      if (Date.now() - this.lastLockNotice > 5000) {
        this.lastLockNotice = Date.now();
        new Notice(this.t('locked'));
      }
    }
  }

  setMode(view, mode) {
    if (!view || view.getMode() === mode) return;
    const vs = view.leaf.getViewState();
    view.leaf.setViewState({ ...vs, state: { ...vs.state, mode } });
  }

  // Writes any pending editor changes to disk before git looks at the files.
  async flushEditors() {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      if (leaf.view instanceof MarkdownView) await leaf.view.save();
    }
  }

  describeError(e) {
    if (e instanceof FlowError) return this.t(e.key);
    const msg = `${e.stderr || ''} ${e.message || ''}`;
    if (e.code === 'ENOENT') return this.t(e.tool === 'gh' ? 'errNoGh' : 'errNoGit');
    if (/not a git repository/i.test(msg)) return this.t('errNotRepo');
    if (/gh auth login|authentication|not logged/i.test(msg)) return this.t('errGhAuth');
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
    this.renderBars();
    try {
      await action();
    } catch (e) {
      console.error('Review Flow', e);
      new Notice(this.describeError(e), 10000);
    } finally {
      this.busy = false;
      this.lastLockNotice = Date.now(); // the bar already says what happened
      await this.refresh();
    }
  }

  // ----- Actions -----

  // Opens the draft that already changes this note, or starts a new one.
  edit(view) {
    view = view || this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view && view.file;
    return this.run(async () => {
      const st = await this.flow.state();
      if (!st.isDraft) {
        await this.flow.updateBase();
        await this.flow.cleanupMerged();
        const draft = file && (await this.flow.draftsByFile()).get(file.path);
        if (draft) await this.flow.openDraft(draft);
        else await this.flow.startDraft(file ? file.basename : 'draft');
        this.state = await this.loadState();
      }
      this.setMode(view, 'source');
    });
  }

  save() {
    return this.run(async () => {
      await this.flushEditors();
      const r = await this.flow.save();
      if (!r.saved) return new Notice(this.t('nothingToSave'));
      new Notice(this.t(r.pushed ? 'saved' : 'savedLocal'), r.pushed ? 3000 : 10000);
    });
  }

  publish() {
    return this.run(async () => {
      await this.flushEditors();
      const st = await this.flow.state();
      const files = st.isDraft ? (await this.flow.draftInfo()).files : st.changes;
      if (!files.length) return new Notice(this.t('nothingToPublish'));
      const doPublish = async (title, details) => {
        await this.flushEditors();
        const r = await this.flow.publish(title, details);
        this.prCache.delete(r.branch);
        const frag = createFragment((f) => {
          f.createSpan({ text: this.t(r.updated ? 'republished' : 'published') + ' ' });
          f.createEl('a', { text: this.t('viewOnGithub'), href: r.url });
        });
        new Notice(frag, 15000);
      };
      // Already waiting for approval: just upload the latest changes.
      if (st.isDraft && (await this.flow.prUrl(st.branch))) return doPublish('', '');
      const title = files.map((f) => baseName(f).replace(/\.md$/, '')).slice(0, 3).join(', ');
      new PublishModal(this, title, (ti, d) => this.run(() => doPublish(ti, d))).open();
    });
  }

  backToBase() {
    return this.run(async () => {
      await this.flushEditors();
      await this.flow.backToBase();
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
    new Setting(el).setName(t('setLock')).setDesc(t('setLockDesc')).addToggle((c) =>
      c.setValue(p.settings.lockBase).onChange(async (v) => {
        p.settings.lockBase = v;
        await p.saveSettings();
      })
    );
    text('setGit', 'gitPath', t('setPathDesc'));
    text('setGh', 'ghPath', t('setPathDesc'));
  }
}

module.exports = ReviewFlowPlugin;
module.exports.default = ReviewFlowPlugin;
Object.assign(module.exports, { GitFlow, FlowError, STRINGS, makeExec, slugify, parseStatus });
