# Test-Fixtures für Import & Deduplizierung (Meilenstein 3)

Zwei Arten von Testdaten:

| Ordner | Inhalt | Herkunft |
|---|---|---|
| `synthetic/` | Gezielt konstruierte Grenzfälle mit **erwartetem Ergebnis** | Frei erfunden, DOIs mit dem Test-Präfix `10.5555` (von Crossref für Tests reserviert), PMIDs im Bereich `99000000+` |
| `real/` | Echte Exporte aus Datenbanken, gleiche Suche in allen Quellen | Siehe `real/MANIFEST.md`. **Abstracts wurden aus Lizenzgründen durch Platzhalter ersetzt** |

## Erwartete Ergebnisse `synthetic/`

Insgesamt 16 Datensätze in 3 Dateien.

| Fall | Datensätze | Erwartung | Regel |
|---|---|---|---|
| A | A1, A2 (RIS) | **zusammenführen**: gleiche DOI trotz Groß-/Kleinschreibung und `https://doi.org/`-Präfix | `doi` |
| B | B-ris (RIS), B-nbib (.nbib) | **zusammenführen** über Dateigrenzen hinweg | `doi` |
| K | K1 (.nbib), K2 (CSV) | **zusammenführen**: gleiche PMID, keine DOI | `pmid` |
| C | C1, C2 (RIS) | **Kandidat** zur manuellen Bestätigung: Titel in Großbuchstaben, Umlaute transliteriert (ü→ue, ß→ss) | `title-fuzzy` |
| D | D1, D2 (RIS) | **Kandidat, nicht automatisch zusammenführen**: Preprint vs. Journal, andere DOI, Jahr +1, britische vs. amerikanische Schreibweise | `title-fuzzy` |
| E | E1 vs. D2 | **nicht zusammenführen**: Erratum („Correction to: …“) | – |
| F | F1, F2 | **nicht zusammenführen**: generischer Titel „Editorial“, andere Autor:innen, Zeitschrift, DOI | – |
| G | G1 | Import ohne Fehler: Buchkapitel (`CHAP`), **kein Jahr**, HTML-Entity `&amp;`, Halbgeviertstrich, Apostroph, Akzente | – |
| H | H1 | Import ohne Fehler: sehr langer Titel, **keine Autor:innen**, Abstract über zwei `AB`-Zeilen (zusammenfügen) | – |
| C1 | C1 | `DO  - ` mit leerem Wert: darf nicht als DOI „“ gespeichert werden | – |
| L | L1 (CSV) | CSV-Escaping: Semikolon, Komma und doppelte Anführungszeichen im Titel | – |

**Erwartete Zählung nach Deduplizierung:** 16 importiert, 3 automatisch zusammengeführt (A, B, K), 2 Kandidatenpaare (C, D) offen zur Entscheidung. Nach Bestätigung von C und Ablehnung von D: **12 eindeutige Datensätze**.

## `real/` – Konventionen

- Dateiname: `<quelle>_<format>.<ext>`, z. B. `scopus_ris.ris`, `pubmed_medline.nbib`, `wos_tagged.txt`, `proquest_ris.ris`, `openalex_csv.csv`
- Pro Quelle ein Eintrag in `real/MANIFEST.md`: Datum, Plattform, exakter Suchstring, Limits, gemeldete Trefferzahl, exportierte Anzahl
- Die gleiche Suche in allen Quellen erzeugt **natürliche Dubletten**. Die erwartete Überschneidung wird nicht vorab festgelegt, sondern nach dem ersten Lauf manuell geprüft und dann als Erwartung in den Tests fixiert.
