# Manifest der echten Test-Exporte

Exportiert am **01.10.2026** von Günther Hochhauser, aufbereitet am selben Tag.
Suchthema in allen Quellen: **„PRISMA-S“**.

## Aufbereitung (vor dem Commit, für alle Dateien)

- **Abstracts** durch `[Abstract für Testzwecke entfernt – Originallänge N Zeichen]` ersetzt (Lizenzbedingungen der Datenbanken). Die Originallänge bleibt erhalten, damit die Oberfläche mit realistischen Längen getestet werden kann. In .nbib wurden mehrzeilige Abstracts zu einer Zeile zusammengefasst.
- **E-Mail-Adressen** (Korrespondenzadressen, Affiliationen) durch `redacted@example.org` ersetzt.
- **ProQuest-Links:** Institutions-ID (`accountid`) aus `UR` entfernt; `L1`/`L2` enthielten Sitzungstoken inklusive IP-Adresse und wurden durch `https://media.proquest.com/media/redacted` ersetzt.
- Alles andere ist unverändert, **einschließlich Zeilenenden** (CRLF bzw. LF), BOM und Kodierung. Das sind bewusst realistische Parser-Testfälle.

## Dateien

| Datei | Quelle | Format | Datensätze | Zeilenende | Besonderheiten |
|---|---|---|---|---|---|
| `scopus_ris.ris` | Scopus | RIS | 209 | LF | `TI`/`T2`, viele `N1` (Export-Datum, Zitationen, Korrespondenz), `C2` (PMID in Scopus-RIS), 2 Datensätze ohne DOI |
| `scopus_csv.csv` | Scopus | CSV (33 Spalten) | 209 | CRLF, UTF-8 mit BOM | Spalten u. a. `DOI`, `PubMed ID`, `Author full names`; dieselben Datensätze wie `scopus_ris.ris` |
| `pubmed_medline.nbib` | PubMed | MEDLINE (.nbib) | 190 | CRLF | Fortsetzungszeilen mit 6 Leerzeichen, DOI in `LID`/`AID` mit Suffix `[doi]`, 1 Datensatz ohne DOI |
| `proquest_ris.ris` | ProQuest | RIS | 20 | CRLF | `T1`/`JF` statt `TI`/`T2`, `Y1` im Format `2026/04//`, Autor:innen mit Titelzusatz (z. B. „Raszewski, Rebecca, AHIP“), deutsche Notizen (`N1 - Zuletzt aktualisiert`) |

Suchstrings, Limits und die gemeldeten Trefferzahlen der Datenbanken wurden nicht protokolliert. Für die Parser-Tests sind die exportierten Anzahlen maßgeblich.

## Beobachtete Überschneidungen (per DOI, normalisiert)

| Paar | Gemeinsame DOIs |
|---|---|
| Scopus ∩ PubMed | **138** |
| Scopus ∩ ProQuest | 2 |
| PubMed ∩ ProQuest | 2 |
| in allen drei | 2 |
| eindeutige DOIs gesamt | 276 |

Zusätzlich verweisen 104 Scopus-Datensätze über die Spalte `PubMed ID` auf eine PMID aus `pubmed_medline.nbib`.

Diese Werte wurden mit einem einfachen DOI-Abgleich ermittelt und **sind noch nicht manuell verifiziert**. Sie dienen als Plausibilitätsrahmen. `scopus_ris.ris` und `scopus_csv.csv` sind Duplikate voneinander; im Test nur eine der beiden Dateien gleichzeitig importieren.

## Hinweis zur Suche

Die Scopus-Treffer sind thematisch breit (z. B. Zahnmedizin, Käsereifung). Die Phrase „PRISMA-S“ wurde offenbar weiter zerlegt als beabsichtigt. Für Parser-Tests ist das egal, als Erkenntnis für das Produkt ist es aber wertvoll: Die Suchdokumentation (Modul 2) könnte bei Bindestrich-Begriffen auf die unterschiedliche Tokenisierung der Datenbanken hinweisen.

## Noch ausstehend

| Datei | Status |
|---|---|
| `openalex_csv.csv` | Neu exportieren: Die gelieferte Datei war eine Gruppierungsstatistik („group by“), keine Datensatzliste |
| `wos_ris.ris` / `wos_tagged.txt` | Optional, falls Web of Science verfügbar |
