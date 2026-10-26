# Review Flow for Obsidian

*[Svenska](README.sv.md)*

Edit Markdown documents in Obsidian and send changes for approval, without having to know git.

Review Flow is for teams that keep documents in a git repository on GitHub and approve every change through a pull request, for example controlled documents in a quality management system. Writers get one panel with one main button. Git and GitHub do the rest in the background.

![The Changes panel next to a document in Obsidian](docs/screenshot.png)

**New here?** Follow [Getting started](GETTING-STARTED.md).

> **Status: prototype (0.1).** The git flow has automated tests. The Obsidian user interface has been tried by hand but not widely yet.

## How it works

Review Flow adds a **Changes** panel to the left sidebar. It is the only place you need to look:

- **The picker at the top** shows where you are: *📖 Approved version* or one of your drafts (*✏️ sop-001*). Pick another draft to switch; your current one is saved first. Drafts that are waiting for approval say so.
- **Changed documents** are listed below it. Click one to open it.
- **One main button: Send for approval.** It sends the draft for review as a pull request. Nothing takes effect until it has been approved. Once sent, the panel shows *Waiting for approval* with a link to GitHub.
- **Discard draft** throws the draft away.

There is no Edit or Save button:

- Documents are never locked. Start typing in the approved version and a draft is created automatically for your change.
- Obsidian saves as you type. Switching drafts or sending uploads everything.
- When a request has been approved and merged, its draft disappears from the picker.

## Installation

[Install Review Flow](https://community.obsidian.md/plugins/review-flow) from Obsidian's community directory, or in Obsidian: **Settings → Community plugins → Browse**, search for **Review Flow**.

Until it has been accepted there, use BRAT: install **BRAT** from the community directory, run **BRAT: Add a beta plugin for testing** and paste `Neurawave/obsidian-review-flow`. Or copy `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/Neurawave/obsidian-review-flow/releases) into `<vault>/.obsidian/plugins/review-flow/`.

The first time, the **Changes** panel guides you through the rest, one step at a time:

1. Install git and the GitHub CLI, if they are missing.
2. Sign in to GitHub with a one-time code.
3. Get the documents: type the repository (for example `organisation/documents`) and, if you like, the folder to edit (for example `qms`). They are downloaded into the vault.

Nothing needs to be added to the documents repository. If pasted images would not be included in the review, the panel says so and offers a button that fixes the setting.

**Approval is enforced by GitHub, not by the plugin.** Protect the approved branch: require a pull request and at least one approving review.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| Approved branch | `main` | The branch with the approved version. |
| Folders | *(whole vault)* | Comma-separated folders that are saved and published, for example `qms`. Changes elsewhere are left alone. |
| Draft branch prefix | `draft/` | Drafts are named `draft/<document>-<yymmdd-hhmmss>`. |
| Language | Auto | English or Swedish. Auto follows Obsidian's language. |
| Path to git / gh | *(automatic)* | Only needed if they are installed somewhere unusual. |

## Limitations

- GitHub only, with the remote named `origin`.
- If two people change the same lines, the conflict shows in the pull request and is resolved there.
- Desktop only; it runs git and gh on your computer.

## What Review Flow needs and does outside the vault

- **A GitHub account**, with access to the repository the documents are in.
- **Programs on your computer:** Review Flow runs `git` and the GitHub CLI `gh`. It makes no network requests of its own; `git` and `gh` talk to GitHub only.
- **Sign-in:** the GitHub sign-in is stored by `gh` in its own configuration, not by Review Flow.
- **Git configuration outside the vault:** for repositories cloned over https, Review Flow runs `gh auth setup-git`, which adds `gh` as the credential helper for github.com in your global git configuration (`~/.gitconfig`).
- **Git configuration in the vault:** if git has no name or email for the repository, Review Flow sets your GitHub name and GitHub's private noreply email in the repository's own configuration (`.git/config`), so your real email address does not end up in the history.
- **No telemetry, no ads, no payments.** The source is open (MIT).

## Development

No build step: `main.js` is the plugin. The tests run the git flow against a temporary repository with a fake `gh`:

```bash
npm test
```

Node.js 18 or later is needed for the tests.

## Releasing

Like other Obsidian plugins, a release is a GitHub release whose tag equals the version in `manifest.json`, with `main.js`, `manifest.json` and `styles.css` attached.

```bash
npm version patch
```

This updates `manifest.json`, `versions.json` and `package.json`, and creates a commit and a tag. Push both with `git push --follow-tags`. The release workflow runs the tests and creates a draft release; publish it on GitHub. The plugin is listed in the community directory by submitting it once at [community.obsidian.md](https://community.obsidian.md), signed in with an Obsidian account linked to GitHub. Later releases are picked up automatically.

## License

[MIT](LICENSE)
