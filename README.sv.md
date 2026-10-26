# Review Flow för Obsidian

*[English](README.md)*

Redigera Markdown-dokument i Obsidian och skicka ändringar för godkännande, utan att behöva kunna git.

Review Flow är till för team som har sina dokument i ett git-repo på GitHub och godkänner varje ändring med en pull request, till exempel styrda dokument i ett kvalitetsledningssystem. Den som skriver får en panel med en huvudknapp. Git och GitHub sköter resten i bakgrunden.

> **Status: prototyp (0.1).** Git-flödet har automatiska tester. Användargränssnittet i Obsidian är ännu inte brett testat.

## Så fungerar det

Review Flow lägger till panelen **Ändringar** i vänsterspalten. Det är det enda stället du behöver titta på:

- **Väljaren överst** visar var du är: *📖 Godkänd version* eller ett av dina utkast (*✏️ sop-001*). Välj ett annat utkast för att byta; det du står i sparas först. Utkast som väntar på godkännande visar det.
- **Ändrade dokument** listas under den. Klicka på ett för att öppna det.
- **En huvudknapp: Skicka för godkännande.** Den skickar utkastet för granskning som en pull request. Inget gäller förrän det har godkänts. När det är skickat visar panelen *Väntar på godkännande* med en länk till GitHub.
- **Släng utkast** kastar utkastet.

Det finns ingen Redigera- eller Spara-knapp:

- Dokumenten är aldrig låsta. Börja skriva i den godkända versionen så skapas ett utkast automatiskt för din ändring.
- Obsidian sparar medan du skriver. Byte av utkast eller Skicka laddar upp allt.
- När en begäran har godkänts och slagits ihop försvinner utkastet ur väljaren.

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
| Mappar | *(hela valvet)* | Kommaseparerade mappar som redigeras och skickas för godkännande, till exempel `qms`. Ändringar på andra ställen lämnas orörda. |
| Prefix för utkastgrenar | `draft/` | Utkast får namnet `draft/<anteckning>-<ååmmdd-ttmm>`. |
| Språk | Auto | Engelska eller svenska. Auto följer Obsidians språk. |
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
