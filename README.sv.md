# Review Flow

*[English](README.md)*

Redigera dokument i Obsidian och skicka dem för godkännande på GitHub, utan att kunna git.

![Panelen Ändringar bredvid ett dokument i Obsidian](docs/screenshot.png)

## Installation

1. Ladda ner [Obsidian](https://obsidian.md/download).
2. Installera [Review Flow](https://community.obsidian.md/plugins/review-flow).
3. Följ panelen **Ändringar** till vänster. Den hjälper dig att logga in på GitHub och hämta dokumenten.

## Användning

- Skriv i ett dokument. Ett utkast skapas automatiskt.
- Tryck **Skicka för godkännande**. Ändringen gäller när den har godkänts på GitHub.
- Byt mellan dina utkast i väljaren överst i panelen.

## Bra att veta

- Kräver ett GitHub-konto och fungerar bara på dator.
- Tillägget kör `git` och `gh` på din dator. De pratar bara med GitHub.
- `gh auth setup-git` lägger till GitHub-inloggningen i din `~/.gitconfig`.
- Ingen telemetri, ingen reklam.
- Godkännandet styrs av GitHub. Skydda grenen `main` så att ändringar kräver godkännande.

## Utveckling

```bash
npm install
npm run build
npm test
```

Källkoden ligger i `src/`. Ny version: `npm version patch` och `git push --follow-tags`.

## Licens

[MIT](LICENSE)
