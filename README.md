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

## Requirements

- Obsidian on desktop (macOS, Windows or Linux).
- [git](https://git-scm.com).
- The [GitHub CLI](https://cli.github.com) (`gh`).
- The vault is a git repository cloned from GitHub (or a folder inside one).

## Installation

Until Review Flow is in Obsidian's community directory, install it with the BRAT plugin:

1. In Obsidian: **Settings → Community plugins**, turn them on, choose **Browse**, find **BRAT**, then **Install** and **Enable**.
2. Open the command palette (Cmd/Ctrl+P), choose **BRAT: Add a beta plugin for testing**, paste `Neurawave/obsidian-review-flow` and click **Add plugin**.
3. In **Settings → Review Flow**, set **Folders** to the folders people edit, for example `qms`.

Or copy `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/Neurawave/obsidian-review-flow/releases) into `<vault>/.obsidian/plugins/review-flow/` and turn the plugin on.

Nothing needs to be added to the documents repository. Each person installs the plugin in their own Obsidian.

If pasted images would not be included in the review (they are saved outside the folders, or linked as `[[wikilinks]]` that GitHub does not show), the panel says so and offers a button that fixes the setting.

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

## Privacy

Review Flow has no telemetry and makes no network calls of its own. It runs `git` and `gh`, which talk only to your repository's remote on GitHub. Branch names come from the note name and the time, not from your user name. The first time, if git has no name or email set for the repository, Review Flow sets your GitHub name and GitHub's private noreply email for that repository only, so your real email address does not end up in the history.

## Development

No build step: `main.js` is the plugin. The tests run the git flow against a temporary repository with a fake `gh`:

```bash
npm test
```

Node.js 18 or later is needed for the tests.

## License

[MIT](LICENSE)
