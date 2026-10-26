# Review Flow för Obsidian

*[English](README.md)*

Redigera Markdown-dokument i Obsidian och skicka ändringar för godkännande, utan att behöva kunna git.

Review Flow är till för team som har sina dokument i ett git-repo på GitHub och godkänner varje ändring med en pull request, till exempel styrda dokument i ett kvalitetsledningssystem. Den som skriver får tre knappar. Git och GitHub sköter resten i bakgrunden.

> **Status: prototyp (0.1).** Git-flödet har automatiska tester. Användargränssnittet i Obsidian är ännu inte brett testat.

## Så fungerar det

| Du trycker | Det här händer |
|---|---|
| **Redigera** | Hämtar den senaste godkända versionen och startar ett utkast (en gren). Du kan också fortsätta ett tidigare utkast. |
| **Spara** | Sparar utkastet (commit) och laddar upp det (push). Fungerar även utan anslutning; uppladdningen sker nästa gång. |
| **Publicera** | Skickar utkastet för godkännande (en pull request) och går tillbaka till den godkända versionen. Publicerar du igen uppdateras samma begäran. |

- **Statusraden** visar var du är: `📖 Godkänd version` eller `✏️ Utkast: sop-001 · 2 osparade`. Klicka på den för mer: tillbaka till godkänd version, släng utkast, öppna begäran på GitHub.
- **Den godkända versionen är skrivskyddad**: anteckningar öppnas i läsläge tills du trycker på Redigera.
- Glömmer du att trycka på Redigera flyttar Spara dina ändringar till ett nytt utkast. Inget hamnar på den godkända grenen.
- När en begäran har godkänts och slagits ihop tas det lokala utkastet bort nästa gång du trycker på Redigera.

## Krav

- Obsidian på dator (macOS, Windows eller Linux).
- [git](https://git-scm.com).
- [GitHub CLI](https://cli.github.com) (`gh`).
- Valvet är ett git-repo klonat från GitHub (eller en mapp i ett).

Logga in en gång i en terminal:

```bash
gh auth login
```

Välj GitHub.com och HTTPS, och svara ja på att git ska använda dina GitHub-uppgifter.

## Installation

Tills tillägget finns i katalogen för community-tillägg:

1. Skapa mappen `<valv>/.obsidian/plugins/review-flow/`.
2. Kopiera `main.js`, `manifest.json` och `styles.css` från en release (eller det här repot) dit.
3. I Obsidian: **Inställningar → Community-tillägg**, slå på **Review Flow**.

## Inställningar

| Inställning | Standard | Betydelse |
|---|---|---|
| Godkänd gren | `main` | Grenen med den godkända versionen. |
| Mappar | *(hela valvet)* | Kommaseparerade mappar som sparas och publiceras, till exempel `qms`. Ändringar på andra ställen lämnas orörda. |
| Prefix för utkastgrenar | `draft/` | Utkast får namnet `draft/<anteckning>-<ååmmdd-ttmm>`. |
| Språk | Auto | Engelska eller svenska. Auto följer Obsidians språk. |
| Skrivskyddad godkänd version | På | Öppnar anteckningar i läsläge utanför utkast. |
| Sökväg till git / gh | *(automatiskt)* | Behövs bara om de är installerade på ett ovanligt ställe. |

## Rekommenderad inställning av repot

Review Flow gör flödet enkelt. Det tvingar inte fram godkännande; det gör GitHub:

- Skydda den godkända grenen: kräv pull request och minst ett godkännande.
- Lägg `.obsidian/workspace*.json` i `.gitignore`, så att fönsterlayouter inte hamnar i commits.

## Begränsningar

- Bara GitHub, med fjärrrepot `origin`.
- Om två personer ändrar samma rader syns konflikten i pull requesten och löses där.
- Bara på dator; tillägget kör git och gh lokalt.

## Integritet

Review Flow har ingen telemetri och gör inga egna nätverksanrop. Det kör `git` och `gh`, som bara pratar med repots fjärrrepo på GitHub. Grennamn byggs av anteckningens namn och tiden, inte av ditt användarnamn.

## Utveckling

Inget byggsteg: `main.js` är tillägget. Testerna kör git-flödet mot ett tillfälligt repo med ett fejkat `gh`:

```bash
npm test
```

Testerna kräver Node.js 18 eller senare.

## Licens

[MIT](LICENSE)
