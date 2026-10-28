# Review Flow

*[Svenska](README.sv.md)*

Edit documents in Obsidian and send them for approval on GitHub, without knowing git.

![The Changes panel next to a document in Obsidian](docs/screenshot.png)

## Installation

1. Download [Obsidian](https://obsidian.md/download).
2. Install [Review Flow](https://community.obsidian.md/plugins/review-flow).
3. Follow the **Changes** panel on the left. It helps you sign in to GitHub and get the documents.

## Usage

- Write in a document. A draft is created automatically.
- Click **Send for approval**. The change takes effect once it is approved on GitHub.
- Switch between your drafts with the picker at the top of the panel.

## Good to know

- Needs a GitHub account and works on desktop only.
- The plugin runs `git` and `gh` on your computer. They only talk to GitHub.
- `gh auth setup-git` adds the GitHub sign-in to your `~/.gitconfig`.
- No telemetry, no ads.
- Approval is enforced by GitHub. Protect the `main` branch so changes need approval.

## Development

```bash
npm install
npm run build
npm test
```

The source is in `src/`. New version: `npm version patch` and `git push --follow-tags`.

## License

[MIT](LICENSE)
