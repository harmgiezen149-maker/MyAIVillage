# Tests van het dorp

Browsertests met een **nagemaakte** Claude, nagemaakte apps (Gmail, Agenda, Kookboek, Darkglass, Dorpsinternet) en een
nagemaakte database. Er wordt dus nooit echt iets gelezen, geschreven of verbruikt.

Draaien:

```sh
cd ai-village/tests
npm install                          # eenmalig (Playwright)
npx playwright install chromium      # eenmalig, als de browser er nog niet is
npm test
```

De tests starten zelf een kleine webserver voor `ai-village/`.

| Bestand | Wat het controleert |
| --- | --- |
| `smoke.test.js` | Het dorp laadt zonder fouten op computer en telefoon; alle vakken openen en sluiten (ook met Escape); Nederlandse teksten; compacte editor op de telefoon. |
| `office.test.js` | Kevin verdeelt, de directeur werkt; onleesbaar antwoord wordt gerepareerd; Verder doet niets dubbel; Controleren en goedkeuren; antwoord in de chat met 👍/👎; nooit meer dan 16 gereedschappen; de modellen; praten maakt een taak; "kom hier"; internetpagina's alleen uit eigen zoekresultaten. |
| `team.test.js` | Iedere directeur antwoordt, hooguit 3 tegelijk, bundel met top 3; profiel en geheugen in de opdrachten; briefing; Alles hervatten; archief, zoeken, verwijderen; alleen-lezen database-gegevens. |
| `walk.test.js` | Klik-en-loop komt aan; een deur gaat naar binnen en de uitgang weer naar buiten. |

GitHub draait deze tests bij elke wijziging (`.github/workflows/tests.yml`), samen met de tests van de internetdeur.
