# OpenAlex-Antworten (Meilenstein 7)

Antworten der OpenAlex-API (`/works`) für Unit- und E2E-Tests. Im CI gibt es **keine Live-Abfragen**: Unit-Tests reichen `fetch` hinein, E2E-Tests beantworten `https://api.openalex.org/**` mit diesen Dateien (`page.route`).

**Herkunft:** Die Dateien sind **nach dem dokumentierten Work-Schema nachgebaut**, weil die API aus der Entwicklungsumgebung von Meilenstein 7 nicht erreichbar war. Sie enthalten nur die Felder, die Facet Review per `select` abfragt. DOIs nutzen das Test-Präfix `10.5555`, PMIDs den Bereich `99000000+`.

Echte Antworten lassen sich lokal aufnehmen und ersetzen die nachgebauten (OpenAlex-Daten stehen unter CC0):

```
node scripts/record-openalex.mjs
```

Das Skript führt die Suche aus `query.json` aus und schreibt `count.json`, `page-1.json` und `page-2.json` neu. Danach Erwartungen in `src/domain/openalex/*.test.ts` und `tests/e2e/openalex.spec.ts` manuell prüfen und anpassen.

| Datei | Inhalt |
|---|---|
| `query.json` | Die Suche, zu der die Antworten gehören |
| `count.json` | Zählabfrage (`per-page=5`): `meta.count` = 3, Vorschau |
| `page-1.json` | Erste Seite, `next_cursor` gesetzt |
| `page-2.json` | Letzte Seite, `next_cursor` = `null` |
| `rate-limited.json` | Fehlertext einer 429-Antwort |

Grenzfälle in den Treffern: Abstract als invertierter Index mit Satzzeichen und Wortwiederholung, Treffer ohne DOI und ohne Abstract, Körperschaft als Autor:in (einteiliger Name), PMID als URL, Buchkapitel, Preprint, Sprache Deutsch, Dublette (gleiche DOI) zu Fall A der synthetischen Fixtures.
