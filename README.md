# Review Flow for Obsidian

*[Svenska](README.sv.md)*

Edit Markdown documents in Obsidian and send changes for approval, without having to know git.

Review Flow is for teams that keep documents in a git repository on GitHub and approve every change through a pull request, for example controlled documents in a quality management system. Writers get one button at a time. Git and GitHub do the rest in the background.

> **Status: prototype (0.1).** The git flow has automated tests. The Obsidian user interface has not been tested widely yet.

## How it works

Every document in the configured folders gets a bar at the top with **one main button**. What it says depends on where you are:

| You see | Main button | What happens |
|---|---|---|
| 📖 **Approved version** | **Edit** | Fetches the latest approved version and starts a draft (a branch) for this document. |
| 📖 **Approved version** – *you have a draft* | **Continue editing** | Opens your draft for this document again. |
| ✏️ **Draft** | **Publish** | Sends the draft for approval (a pull request) and shows the approved version again. |
| ⏳ **Waiting for approval** | **Done** | Back to the approved version. Change more and the button becomes **Publish changes**. |

- There is no save button: Obsidian saves as you type. Publish uploads everything.
- Next to the main button are two small links: **Save and close** (leave the draft for later) and **Discard draft**.
- The **approved version is read-only**: notes open in reading view until you click Edit.
- When a request has been approved and merged, its draft is removed the next time you click Edit.
- All actions are also in the command palette.

## Requirements

- Obsidian on desktop (macOS, Windows or Linux).
- [git](https://git-scm.com).
- The [GitHub CLI](https://cli.github.com) (`gh`).
- The vault is a git repository cloned from GitHub (or a folder inside one).

Sign in once in a terminal:

```bash
gh auth login
```

Choose GitHub.com, HTTPS, and answer yes to authenticating git with your GitHub credentials.

## Installation

Until the plugin is in the community directory:

1. Create the folder `<vault>/.obsidian/plugins/review-flow/`.
2. Copy `main.js`, `manifest.json` and `styles.css` from a release (or this repository) into it.
3. In Obsidian: **Settings → Community plugins**, turn on **Review Flow**.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| Approved branch | `main` | The branch with the approved version. |
| Folders | *(whole vault)* | Comma-separated folders that are saved and published, for example `qms`. Changes elsewhere are left alone. |
| Draft branch prefix | `draft/` | Drafts are named `draft/<note>-<yymmdd-hhmm>`. |
| Language | Auto | English or Swedish. Auto follows Obsidian's language. |
| Read-only approved version | On | Opens notes in reading view outside drafts. |
| Path to git / gh | *(automatic)* | Only needed if they are installed somewhere unusual. |

## Recommended repository setup

Review Flow makes the flow easy. It does not enforce approval; GitHub does that:

- Protect the approved branch: require a pull request and at least one approving review.
- Add `.obsidian/workspace*.json` to `.gitignore`, so window layouts do not end up in commits.

## Limitations

- GitHub only, with the remote named `origin`.
- If two people change the same lines, the conflict shows in the pull request and is resolved there.
- Desktop only; it runs git and gh on your computer.

## Privacy

Review Flow has no telemetry and makes no network calls of its own. It runs `git` and `gh`, which talk only to your repository's remote on GitHub. Branch names come from the note name and the time, not from your user name.

## Development

No build step: `main.js` is the plugin. The tests run the git flow against a temporary repository with a fake `gh`:

```bash
npm test
```

Node.js 18 or later is needed for the tests.

## License

[MIT](LICENSE)
