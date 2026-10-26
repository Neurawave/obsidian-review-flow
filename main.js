'use strict';

// Review Flow – edit Markdown in Obsidian with a simple review flow on top of git:
// Edit (draft branch) → Save (commit + push) → Publish (pull request for approval).
// Plain JavaScript, no build step. Desktop only (uses git and the GitHub CLI `gh`).

const obsidian = require('obsidian');
const { Plugin, Notice, Modal, SuggestModal, Setting, PluginSettingTab, Menu, MarkdownView, FileSystemAdapter } = obsidian;
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

// ---------- Strings ----------

const STRINGS = {
  en: {
    edit: 'Edit',
    save: 'Save',
    publish: 'Publish',
    discard: 'Discard draft',
    backToBase: 'Back to approved version',
    refresh: 'Refresh status',
    openPr: 'Open approval request on GitHub',
    statusBase: '📖 Approved version',
    statusDraft: (name, n) => `✏️ Draft: ${name}` + (n ? ` · ${n} unsaved` : ' · saved'),
    statusOther: (b) => `⎇ ${b}`,
    statusError: '⚠ Review Flow',
    busy: 'Working…',
    locked: 'This is the approved version. Click Edit to make changes.',
    alreadyEditing: (n) => `You are editing the draft “${n}”.`,
    draftCreated: (n) => `New draft “${n}”. Your changes stay in the draft until they are approved.`,
    draftOpened: (n) => `Continuing the draft “${n}”.`,
    newDraft: '+ New draft',
    continueDraft: (n) => `Continue: ${n}`,
    pickDraft: 'Continue a draft or start a new one',
    nothingToSave: 'No changes to save.',
    saved: 'Saved.',
    savedLocal: 'Saved on this computer only (no connection). It is uploaded the next time you save.',
    nothingToPublish: 'Nothing to publish. Click Edit and make a change first.',
    publishTitle: 'Publish for approval',
    publishIntro: 'Your changes are sent for review. They take effect when they have been approved.',
    fieldTitle: 'What did you change?',
    fieldBody: 'More details (optional)',
    cancel: 'Cancel',
    published: 'Sent for approval. The change shows here once it has been approved.',
    republished: 'The approval request is updated with your latest changes.',
    openOnGithub: 'Open on GitHub',
    discardConfirm: (n) => `Discard the draft “${n}”? All changes in it are deleted and any open approval request is closed. This cannot be undone.`,
    discarded: 'The draft was discarded.',
    backedToBase: 'Showing the approved version.',
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
    setFoldersDesc: 'Comma-separated folders (relative to the vault) that are saved and published. Empty means the whole vault.',
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
    save: 'Spara',
    publish: 'Publicera',
    discard: 'Släng utkast',
    backToBase: 'Tillbaka till godkänd version',
    refresh: 'Uppdatera status',
    openPr: 'Öppna begäran om godkännande på GitHub',
    statusBase: '📖 Godkänd version',
    statusDraft: (name, n) => `✏️ Utkast: ${name}` + (n ? ` · ${n} osparade` : ' · sparat'),
    statusOther: (b) => `⎇ ${b}`,
    statusError: '⚠ Review Flow',
    busy: 'Arbetar…',
    locked: 'Det här är den godkända versionen. Tryck på Redigera för att ändra.',
    alreadyEditing: (n) => `Du redigerar utkastet ”${n}”.`,
    draftCreated: (n) => `Nytt utkast ”${n}”. Ändringarna stannar i utkastet tills de har godkänts.`,
    draftOpened: (n) => `Fortsätter med utkastet ”${n}”.`,
    newDraft: '+ Nytt utkast',
    continueDraft: (n) => `Fortsätt: ${n}`,
    pickDraft: 'Fortsätt ett utkast eller starta ett nytt',
    nothingToSave: 'Inga ändringar att spara.',
    saved: 'Sparat.',
    savedLocal: 'Sparat bara på den här datorn (ingen anslutning). Laddas upp nästa gång du sparar.',
    nothingToPublish: 'Inget att publicera. Tryck på Redigera och gör en ändring först.',
    publishTitle: 'Publicera för godkännande',
    publishIntro: 'Ändringarna skickas för granskning. De gäller först när de har godkänts.',
    fieldTitle: 'Vad har du ändrat?',
    fieldBody: 'Mer detaljer (valfritt)',
    cancel: 'Avbryt',
    published: 'Skickat för godkännande. Ändringen syns här när den har godkänts.',
    republished: 'Begäran om godkännande är uppdaterad med dina senaste ändringar.',
    openOnGithub: 'Öppna på GitHub',
    discardConfirm: (n) => `Släng utkastet ”${n}”? Alla ändringar i det raderas och en öppen begäran om godkännande stängs. Det går inte att ångra.`,
    discarded: 'Utkastet är slängt.',
    backedToBase: 'Visar den godkända versionen.',
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
    setFoldersDesc: 'Kommaseparerade mappar (relativt valvet) som sparas och publiceras. Tomt betyder hela valvet.',
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

  displayName(branch) {
    return branch.slice(this.s.branchPrefix.length).replace(/-\d{6}-\d{4}$/, '');
  }

  async state() {
    const branch = await this.git('branch', '--show-current');
    const changes = parseStatus(await this.git('status', '--porcelain', '-z', '--untracked-files=all', '--', ...this.paths()));
    return { branch, onBase: branch === this.s.baseBranch, isDraft: this.isDraft(branch), changes };
  }

  async drafts() {
    const out = await this.git('branch', '--list', `${this.s.branchPrefix}*`, '--format=%(refname:short)');
    return out ? out.split('\n').filter(Boolean) : [];
  }

  // Fetches the latest approved version. Returns false when offline.
  async updateBase() {
    try {
      await this.git('pull', '--ff-only', 'origin', this.s.baseBranch);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Removes local drafts whose pull request has been merged.
  async cleanupMerged() {
    const current = await this.git('branch', '--show-current');
    for (const d of await this.drafts()) {
      if (d === current) continue;
      try {
        if ((await this.gh('pr', 'view', d, '--json', 'state', '--jq', '.state')) === 'MERGED') {
          await this.git('branch', '-D', d);
        }
      } catch (e) {
        // No pull request or offline: keep the draft.
      }
    }
  }

  async startDraft(label) {
    const st = await this.state();
    if (!st.onBase) await this.git('switch', this.s.baseBranch);
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

  async changedSinceBase() {
    const st = await this.state();
    let files = [];
    if (st.isDraft) {
      const out = await this.git('diff', '--name-only', `${this.s.baseBranch}...HEAD`, '--', ...this.paths());
      files = out ? out.split('\n') : [];
    }
    return [...new Set([...files, ...st.changes])];
  }

  async prUrl(branch) {
    try {
      const out = await this.gh('pr', 'view', branch, '--json', 'url,state', '--jq', 'select(.state == "OPEN") | .url');
      return out || null;
    } catch (e) {
      return null;
    }
  }

  // Saves, uploads and opens (or updates) a pull request, then returns to the approved version.
  async publish(title, details) {
    const files = await this.changedSinceBase();
    await this.save();
    const st = await this.state();
    if (!st.isDraft) throw new FlowError('nothingToPublish');
    if ((await this.git('rev-list', '--count', `${this.s.baseBranch}..HEAD`)) === '0') throw new FlowError('nothingToPublish');
    await this.push(true);
    let url = await this.prUrl(st.branch);
    const updated = !!url;
    if (!url) {
      const body = [details, `${this.t('prFiles')}:\n` + files.map((f) => `- ${f}`).join('\n'), `_${this.t('prFooter')}_`]
        .filter(Boolean).join('\n\n');
      const out = await this.gh('pr', 'create', '--base', this.s.baseBranch, '--head', st.branch, '--title', title, '--body', body);
      url = out.split('\n').pop().trim();
    }
    await this.git('switch', this.s.baseBranch);
    await this.updateBase();
    return { url, updated, branch: st.branch };
  }

  async backToBase() {
    const st = await this.state();
    if (st.changes.length && st.isDraft) await this.save();
    await this.git('switch', this.s.baseBranch);
    await this.updateBase();
  }

  // Deletes the current draft locally and on GitHub, closing any open pull request.
  async discard() {
    const st = await this.state();
    if (!st.isDraft) throw new FlowError('errNotOnDraft');
    await this.git('reset', '--hard', 'HEAD');
    await this.git('clean', '-fd', '--', ...this.paths());
    await this.git('switch', this.s.baseBranch);
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

class DraftPicker extends SuggestModal {
  constructor(plugin, drafts, onChoose) {
    super(plugin.app);
    this.plugin = plugin;
    this.items = [null, ...drafts];
    this.onChoose = onChoose;
    this.setPlaceholder(plugin.t('pickDraft'));
  }

  getSuggestions(query) {
    const q = query.toLowerCase();
    return this.items.filter((d) => d === null || d.toLowerCase().includes(q));
  }

  renderSuggestion(d, el) {
    el.setText(d === null ? this.plugin.t('newDraft') : this.plugin.t('continueDraft', this.plugin.flow.displayName(d)));
  }

  onChooseSuggestion(d) {
    this.onChoose(d);
  }
}

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
    this.titleEl.setText(t('publishTitle'));
    this.contentEl.createEl('p', { text: t('publishIntro') });
    new Setting(this.contentEl).setName(t('fieldTitle')).addText((c) => {
      c.setValue(this.title).onChange((v) => (this.title = v));
      c.inputEl.addClass('review-flow-wide');
      setTimeout(() => c.inputEl.select(), 0);
    });
    new Setting(this.contentEl).setName(t('fieldBody')).addTextArea((c) => {
      c.onChange((v) => (this.details = v));
      c.inputEl.addClass('review-flow-wide');
      c.inputEl.rows = 4;
    });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t('cancel')).onClick(() => this.close()))
      .addButton((b) =>
        b.setButtonText(t('publish')).setCta().onClick(() => {
          if (!this.title.trim()) return;
          this.close();
          this.onSubmit(this.title.trim(), this.details.trim());
        })
      );
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
    this.lastLockNotice = 0;
    this.flow = new GitFlow(
      makeExec(() => this.vaultPath(), () => this.settings),
      () => this.settings,
      (k, ...a) => this.t(k, ...a)
    );

    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass('review-flow-status');
    this.statusEl.onClickEvent((evt) => this.showMenu(evt));

    this.addRibbonIcon('pencil', this.t('edit'), () => this.edit());
    this.addRibbonIcon('save', this.t('save'), () => this.save());
    this.addRibbonIcon('send', this.t('publish'), () => this.publish());

    this.addCommand({ id: 'edit', name: this.t('edit'), callback: () => this.edit() });
    this.addCommand({ id: 'save', name: this.t('save'), callback: () => this.save() });
    this.addCommand({ id: 'publish', name: this.t('publish'), callback: () => this.publish() });
    this.addCommand({ id: 'back-to-approved', name: this.t('backToBase'), callback: () => this.backToBase() });
    this.addCommand({ id: 'discard', name: this.t('discard'), callback: () => this.discard() });
    this.addCommand({ id: 'refresh', name: this.t('refresh'), callback: () => this.refresh() });

    this.addSettingTab(new ReviewFlowSettingTab(this.app, this));

    const lock = () => this.enforceLock();
    this.registerEvent(this.app.workspace.on('layout-change', lock));
    this.registerEvent(this.app.workspace.on('active-leaf-change', lock));
    this.registerEvent(this.app.workspace.on('file-open', lock));
    const soon = () => this.refreshSoon();
    for (const evt of ['modify', 'create', 'delete', 'rename']) this.registerEvent(this.app.vault.on(evt, soon));
    this.registerDomEvent(window, 'focus', soon);
    this.registerInterval(window.setInterval(() => this.refresh(), 30000));

    this.app.workspace.onLayoutReady(() => this.refresh());
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

  // ----- State and status bar -----

  refreshSoon() {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refresh(), 800);
  }

  async refresh() {
    if (this.busy) return;
    try {
      this.state = await this.flow.state();
    } catch (e) {
      this.state = { error: e };
    }
    this.renderStatus();
    this.enforceLock();
  }

  renderStatus() {
    const s = this.state;
    if (!s) return;
    let text;
    if (s.error) text = this.t('statusError');
    else if (s.isDraft) text = this.t('statusDraft', this.flow.displayName(s.branch), s.changes.length);
    else if (s.onBase) text = this.t('statusBase');
    else text = this.t('statusOther', s.branch || '?');
    this.statusEl.setText(this.busy ? `${text} · ${this.t('busy')}` : text);
    this.statusEl.setAttr('aria-label', s.error ? this.describeError(s.error) : '');
  }

  inScope(path) {
    const folders = this.flow.paths();
    return folders.includes('.') || folders.some((f) => path === f || path.startsWith(f + '/'));
  }

  // Keeps notes in reading view while the approved version is shown.
  enforceLock() {
    const s = this.state;
    if (!this.settings.lockBase || !s || s.error || s.isDraft) return;
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file || !this.inScope(view.file.path)) continue;
      if (view.getMode() !== 'source') continue;
      const vs = leaf.getViewState();
      leaf.setViewState({ ...vs, state: { ...vs.state, mode: 'preview' } });
      if (Date.now() - this.lastLockNotice > 5000) {
        this.lastLockNotice = Date.now();
        new Notice(this.t('locked'));
      }
    }
  }

  setEditMode() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.getMode() === 'source') return;
    const leaf = view.leaf;
    const vs = leaf.getViewState();
    leaf.setViewState({ ...vs, state: { ...vs.state, mode: 'source' } });
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

  // Runs one action at a time, shows errors in plain language and refreshes the status afterwards.
  async run(action) {
    if (this.busy) {
      new Notice(this.t('busy'));
      return;
    }
    this.busy = true;
    this.renderStatus();
    try {
      await action();
    } catch (e) {
      console.error('Review Flow', e);
      new Notice(this.describeError(e), 10000);
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  linkNotice(message, url) {
    const frag = createFragment((f) => {
      f.createSpan({ text: message + ' ' });
      if (url) f.createEl('a', { text: this.t('openOnGithub'), href: url });
    });
    new Notice(frag, 15000);
  }

  // ----- Actions -----

  edit() {
    return this.run(async () => {
      const st = await this.flow.state();
      if (st.isDraft) {
        this.setEditMode();
        new Notice(this.t('alreadyEditing', this.flow.displayName(st.branch)));
        return;
      }
      await this.flow.updateBase();
      await this.flow.cleanupMerged();
      const drafts = await this.flow.drafts();
      if (!drafts.length) return this.newDraft();
      new DraftPicker(this, drafts, (d) =>
        this.run(async () => {
          if (d === null) return this.newDraft();
          await this.flow.openDraft(d);
          this.setEditMode();
          new Notice(this.t('draftOpened', this.flow.displayName(d)));
        })
      ).open();
    });
  }

  async newDraft() {
    const file = this.app.workspace.getActiveFile();
    const name = await this.flow.startDraft(file ? file.basename : 'draft');
    this.setEditMode();
    new Notice(this.t('draftCreated', this.flow.displayName(name)), 8000);
  }

  save() {
    return this.run(async () => {
      await this.flushEditors();
      const r = await this.flow.save();
      if (!r.saved) return new Notice(this.t('nothingToSave'));
      if (r.created) new Notice(this.t('draftCreated', this.flow.displayName(r.created)), 8000);
      new Notice(this.t(r.pushed ? 'saved' : 'savedLocal'), r.pushed ? 3000 : 10000);
    });
  }

  publish() {
    return this.run(async () => {
      await this.flushEditors();
      const st = await this.flow.state();
      if (!st.isDraft && !(st.onBase && st.changes.length)) return new Notice(this.t('nothingToPublish'));
      const doPublish = async (title, details) => {
        await this.flushEditors();
        const r = await this.flow.publish(title, details);
        this.linkNotice(this.t(r.updated ? 'republished' : 'published'), r.url);
      };
      // Already waiting for approval: just upload the latest changes.
      if (st.isDraft && (await this.flow.prUrl(st.branch))) return doPublish('', '');
      const files = await this.flow.changedSinceBase();
      const title = files.map((f) => baseName(f).replace(/\.md$/, '')).slice(0, 3).join(', ');
      new PublishModal(this, title, (t, d) => this.run(() => doPublish(t, d))).open();
    });
  }

  backToBase() {
    return this.run(async () => {
      await this.flushEditors();
      await this.flow.backToBase();
      new Notice(this.t('backedToBase'));
    });
  }

  discard() {
    const st = this.state;
    if (!st || !st.isDraft) return new Notice(this.t('errNotOnDraft'));
    new ConfirmModal(this, this.t('discardConfirm', this.flow.displayName(st.branch)), this.t('discard'), () =>
      this.run(async () => {
        await this.flow.discard();
        new Notice(this.t('discarded'));
      })
    ).open();
  }

  async showMenu(evt) {
    const s = this.state || {};
    const menu = new Menu();
    if (s.error) menu.addItem((i) => i.setTitle(this.describeError(s.error)).setIcon('alert-triangle').setDisabled(true));
    if (s.isDraft) {
      menu.addItem((i) => i.setTitle(this.t('save')).setIcon('save').onClick(() => this.save()));
      menu.addItem((i) => i.setTitle(this.t('publish')).setIcon('send').onClick(() => this.publish()));
      const url = await this.flow.prUrl(s.branch);
      if (url) menu.addItem((i) => i.setTitle(this.t('openPr')).setIcon('external-link').onClick(() => window.open(url)));
      menu.addSeparator();
      menu.addItem((i) => i.setTitle(this.t('backToBase')).setIcon('book-open').onClick(() => this.backToBase()));
      menu.addItem((i) => i.setTitle(this.t('discard')).setIcon('trash').onClick(() => this.discard()));
    } else if (!s.error) {
      menu.addItem((i) => i.setTitle(this.t('edit')).setIcon('pencil').onClick(() => this.edit()));
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(this.t('refresh')).setIcon('refresh-cw').onClick(() => this.refresh()));
    menu.showAtMouseEvent(evt);
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
