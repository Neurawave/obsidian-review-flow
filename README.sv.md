# Review Flow för Obsidian

*[English](README.md)*

Redigera Markdown-dokument i Obsidian och skicka ändringar för godkännande, utan att behöva kunna git.

Review Flow är till för team som har sina dokument i ett git-repo på GitHub och godkänner varje ändring med en pull request, till exempel styrda dokument i ett kvalitetsledningssystem. Den som skriver får en knapp i taget. Git och GitHub sköter resten i bakgrunden.

> **Status: prototyp (0.1).** Git-flödet har automatiska tester. Användargränssnittet i Obsidian är ännu inte brett testat.

## Så fungerar det

Varje dokument i de inställda mapparna får en rad överst med **en enda huvudknapp**. Vad den säger beror på var du är:

| Du ser | Huvudknapp | Det här händer |
|---|---|---|
| 📖 **Godkänd version** | **Redigera** | Hämtar den senaste godkända versionen och startar ett utkast (en gren) för dokumentet. |
| 📖 **Godkänd version** – *du har ett utkast* | **Fortsätt redigera** | Öppnar ditt utkast för dokumentet igen. |
| ✏️ **Utkast** | **Publicera** | Skickar utkastet för godkännande (en pull request) och visar den godkända versionen igen. |
| ⏳ **Väntar på godkännande** | **Klar** | Tillbaka till den godkända versionen. Ändrar du mer blir knappen **Publicera ändringarna**. |

- Det finns ingen spara-knapp: Obsidian sparar medan du skriver. Publicera laddar upp allt.
- Bredvid huvudknappen finns två små länkar: **Spara och stäng** (lämna utkastet till senare) och **Släng utkast**.
- **Den godkända versionen är skrivskyddad**: dokument öppnas i läsläge tills du trycker på Redigera.
- När en begäran har godkänts och slagits ihop tas utkastet bort nästa gång du trycker på Redigera.
- Alla funktioner finns också i kommandopaletten.

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
| Mappar | *(hela valvet)* | Kommaseparerade mappar som redigeras och publiceras, till exempel `qms`. Ändringar på andra ställen lämnas orörda. |
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
