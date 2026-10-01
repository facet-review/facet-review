# Facet Review – Produktbeschreibung (PRD)

**Version:** 0.1 (Brainstorming-Ergebnis, 30.09.2026)
**Autor:** Günther Hochhauser
**Status:** Freigegeben für Meilenstein 0

---

## 1. Vision und Positionierung

**Facet Review** unterstützt Einzelpersonen dabei, einen Systematic Review **nachvollziehbar zu dokumentieren und zu berichten**, von der ersten Suchanfrage bis zur ausgefüllten PRISMA-Checkliste.

- **Name:** Facet Review. Die Facette steht für die Prismenfläche und zugleich für die Facettensuche im Bibliothekswesen.
- **Slogan:** *Jede Facette Ihrer Suche. Nachvollziehbar.* / *Every facet of your search. Traceable.*
- **Untertitel:** Systematic Reviews nach PRISMA 2020 & PRISMA-S
- **Domain:** facetreview.org (Hauptadresse), facetreview.com (Weiterleitung)
- **GitHub:** Organisation `facet-review`
- **Lizenz:** AGPL-3.0

### Abgrenzung

| Tool | Stärke | Lücke, die Facet Review füllt |
|---|---|---|
| Covidence, EPPI-Reviewer | Umfassendes Team-Screening | Kostenpflichtig bzw. komplex; die Suchdokumentation nach PRISMA-S ist schwach |
| Rayyan | Screening | Keine Suchdokumentation, kein Flow-Diagramm aus Daten |
| PRISMA2020-Shiny-App | Flow-Diagramm zeichnen | Die Zahlen werden von Hand eingetippt und sind nicht belegbar |
| Word und Excel | Flexibel | Fehleranfällig, keine Kette |

**Alleinstellungsmerkmal:** Die Kette Suche → Treffer → Entscheidung → Zahl → Diagramm → Checkliste, local-first, offen und kostenlos.

## 2. Zielgruppe

**Version 1:** Einzelpersonen, vor allem Studierende (Bachelor- und Masterarbeiten) sowie Forschende, die allein reviewen. Die erste Testumgebung sind Abschlussarbeiten an der FH OÖ, Campus Wels.

**Später:** Kleine Teams mit zwei unabhängigen Screener:innen und Bibliotheken als Multiplikatoren, z. B. in Schulungen.

### Methodische Ehrlichkeit bei Einzelpersonen

PRISMA Item 8 verlangt Angaben zur Anzahl der Reviewer:innen und zu ihrer Unabhängigkeit. Facet Review dokumentiert „single reviewer“ transparent. Optional (siehe Roadmap) lässt sich eine Stichprobe für die Gegenprüfung durch eine zweite Person exportieren; daraus wird Cohens Kappa berechnet.

## 3. Funktionsumfang Version 1 (MVP)

### Modul 1: Projekt

- Titel und Forschungsfrage, optional strukturiert (PICO, PICo, SPIDER oder frei).
- Ein- und Ausschlusskriterien als Liste (liefert PRISMA Item 5).
- **Vordefinierte Ausschlussgründe** für das Volltext-Screening, frei editierbar und sortierbar (Beispiele: falsche Population, falsches Studiendesign, falsches Outcome, falsche Sprache, falscher Zeitraum).
- Review-Typ: neuer Review oder Update (steuert die Variante des Flow-Diagramms).
- Registrierung und Protokoll: Freitext und URL, z. B. PROSPERO oder OSF (liefert Item 24a und 24b).
- Metadaten: Autor:in, Institution, Sprache.

### Modul 2: Suchdokumentation (PRISMA-S)

Jede **Quelle** wird dokumentiert mit Typ und typspezifischen Feldern.

| Quellentyp | PRISMA-S-Item | Pflichtfelder |
|---|---|---|
| Bibliografische Datenbank | 1, 2 | Datenbankname, Plattform bzw. Interface (z. B. „MEDLINE via Ovid“), Suchstring (vollständig, mehrzeilig), Limits und Filter, Datum, gemeldete Trefferzahl |
| Studienregister | 3 | Registername, Suchstring, Datum, Trefferzahl |
| Online-Ressourcen und Websites | 4 | URL, Vorgehen (Suche, Browsing), Datum, Trefferzahl |
| Suchmaschine (z. B. Google Scholar) | 4 | Suchstring, Datum, Anzahl geprüfter Seiten bzw. Treffer, Werkzeug (GSscraper, Publish or Perish) |
| Zitationssuche | 5 | Richtung (vorwärts, rückwärts), Ausgangsdokumente, Werkzeug, Datum |
| Kontakte zu Expert:innen und Organisationen | 6 | Beschreibung, Datum |
| Sonstige Methode | 7 | Beschreibung |

Dazu kommen **projektweite Angaben:**

- Suchfilter bzw. Validierte Filter mit Quelle (Item 10)
- Nachnutzung früherer Suchen (Item 11)
- Aktualisierungen der Suche (Item 12)
- Peer Review der Suchstrategie, z. B. PRESS (Item 14)

**Mehrfache Ausführung:** Eine Quelle kann mehrmals ausgeführt werden, etwa für ein Update. Jede Ausführung hat eigenes Datum, eigenen String und eigene Trefferzahl.

**OpenAlex-Suche:** Direkt aus dem Tool über die OpenAlex-API. Suchstring, Filter und Datum werden automatisch protokolliert, die Treffer direkt importiert. Das Tool fügt nach der Konvention von OpenAlex eine `mailto`-Angabe hinzu, und zwar die der Nutzerin, falls hinterlegt.

**Umsetzung OpenAlex (Meilenstein 7):** eigene Seite „Suche in OpenAlex“ im Modul Suche (`src/domain/openalex/`).

- **Suche:** Suchstring unverändert, durchsuchte Felder wählbar (Titel und Abstract = `title_and_abstract.search`, Standard; nur Titel; Volltext-Index = `search`). Limits: Erscheinungsjahr von/bis, Publikationstypen, Sprachen (ISO 639-1), nur Open Access. Kommas im Suchstring sind bei Feldsuchen nicht erlaubt, weil OpenAlex damit Filter trennt (verständliche Fehlermeldung statt stiller Verfälschung).
- **Ablauf:** erst „Treffer zählen“ (eine kleine Anfrage, Vorschau der ersten Titel), dann „importieren“. Alle Seiten werden per Cursor geladen (200 je Seite, mindestens 150 ms Abstand, bei 429/5xx `Retry-After` bzw. 1/2/4 s Backoff, höchstens drei Wiederholungen). **Erst wenn alle Seiten da sind, wird in einer Transaktion gespeichert** (Quelle „OpenAlex“ mit Plattform „OpenAlex API“, beim ersten Mal angelegt; Suchlauf; Importdatei; Datensätze). Abbruch oder Fehler speichern nichts – kein halb protokollierter Suchlauf in der Kette.
- **Automatisches Protokoll (Suchlauf):** Datum (lokaler Tag), Suchstring in Parameterform (z. B. `title_and_abstract.search:…`), Limits lesbar plus Roh-Filter `filter=…` (ohne Limits: „Keine Limits angewendet“), gemeldete Trefferzahl `meta.count`, Notiz mit der vollständigen Abfrage-URL **ohne** E-Mail-Adresse und Key.
- **Obergrenze 10 000 Treffer pro Import** (Performance-Ziel §6); darüber muss die Suche eingeschränkt werden.
- **mailto und optionaler API-Key** werden nur gesendet, wenn die Nutzerin sie einträgt, und **nur im Browser** gespeichert (localStorage), nie im Projekt oder Export. Der Key ist vorsorglich vorgesehen; die aktuelle OpenAlex-Dokumentation war während der Umsetzung nicht erreichbar.
- **Abbildung:** Work → CSL (Abstract aus dem invertierten Index rekonstruiert, Namen „Vorname Nachname“ mit Namenszusätzen wie „van der“ zum Nachnamen, einteilige Namen als Körperschaft). `raw` ist das Work als JSON, `sourceLine` die Position in der Trefferliste. DOI/PMID-Dubletten zu Datei-Importen werden automatisch erkannt.
- **Tests ohne Live-Abfragen:** nachgebaute Antworten in `tests/fixtures/openalex/`; `scripts/record-openalex.mjs` ersetzt sie durch echte Aufnahmen.
- Offline zeigt die Seite einen Hinweis; alles andere funktioniert weiter.

**Export:** Die Suchdokumentation lässt sich als Anhang für die Arbeit exportieren (PDF und Markdown), einschließlich der vollständigen Suchstrings aller Quellen (Item 8).

### Modul 3: Import & Deduplizierung

**Import pro Quelle bzw. Ausführung:** RIS, BibTeX, .nbib, CSV (mit Spalten-Mapping-Dialog).

- Jeder importierte Datensatz behält seine **Herkunft** (`sourceRunId`) und die Rohdaten (`raw`).
- **Abgleich:** Die gemeldete Trefferzahl wird mit der importierten Anzahl verglichen. Bei Abweichung erscheint eine Warnung, die Nutzerin kann sie bewusst bestätigen und begründen.

**Deduplizierung:**

1. Exakte Übereinstimmung der normalisierten DOI.
2. Exakte Übereinstimmung der PMID.
3. Normalisierter Titel (Kleinschreibung, ohne Satzzeichen, ohne Diakritika), Jahr ±1 und erster Autor: Ähnlichkeitswert (z. B. Jaro-Winkler oder Levenshtein-Ratio). Ab einem Schwellenwert (festgelegt: Levenshtein-Ratio 0,90, Begründung in Abschnitt 4) wird das Paar als **Kandidat** zur manuellen Bestätigung vorgeschlagen.
4. Sichere Treffer (1 und 2) werden automatisch zusammengeführt, aber **rückgängig gemacht werden kann das jederzeit.**
5. Jede Zusammenführung bildet eine `DuplicateGroup` mit einem Primärdatensatz und protokollierter Regel (`rule: 'doi' | 'pmid' | 'title-fuzzy' | 'manual'`).

**Automatisierung und sonstige Entfernungen vor dem Screening:** Datensätze können mit Begründung als „vor dem Screening entfernt“ markiert werden, mit der Unterscheidung „durch Automation-Tool“ bzw. „aus anderem Grund“ (eigene Boxen im Flow-Diagramm). Umgesetzt in Meilenstein 4 als protokollierte, rücknehmbare Entscheidung (`stage: 'pre_screening'`) in der Screening-Ansicht.

### Modul 4: Screening

**Stufe 1: Titel und Abstract**

- Ansicht eines Datensatzes nach dem anderen: Titel, Autor:innen, Jahr, Journal, Abstract, DOI-Link.
- Tastatur: `I` = einschließen, `E` = ausschließen, `M` = vielleicht, `←/→` = navigieren, `Z` = letzte Entscheidung rückgängig.
- Hervorhebung von Suchbegriffen im Text (Highlight-Liste pro Projekt, getrennt nach ein- und ausschließenden Begriffen).
- Fortschrittsanzeige, Filter (offen, vielleicht, eingeschlossen, ausgeschlossen).
- Vor Stufe 2 müssen alle „vielleicht“-Einträge aufgelöst sein, oder die Nutzerin entscheidet bewusst, sie in Stufe 2 mitzunehmen (Einstellung).
- In Stufe 1 ist ein Ausschlussgrund optional.

**Stufe 2: Volltext**

- Alle aus Stufe 1 eingeschlossenen Datensätze gelten als „reports sought for retrieval“.
- Pro Datensatz: **Nicht beschaffbar** (mit optionaler Notiz), **Eingeschlossen** oder **Ausgeschlossen** mit **Pflicht-Ausschlussgrund** aus der Projektliste.
- Links: DOI, OpenAlex, Unpaywall-Link (OA-Status über OpenAlex). **Kein PDF-Upload in Version 1.**
- **Reports vs. Studien:** Mehrere eingeschlossene Reports können einer Studie zugeordnet werden (Standard 1:1). Das ist nötig für „Studies included“ vs. „Reports of included studies“.

**Entscheidungen:** Jede Entscheidung wird als eigener Eintrag gespeichert (`Decision` mit `reviewerId`, `stage`, `value`, `reasonId`, `note`, `timestamp`). Der aktuelle Status ergibt sich aus der letzten Entscheidung. Die Historie bleibt erhalten, sie ist ein Audit-Trail.

### Modul 5: Flow-Diagramm (PRISMA 2020)

- **Vier Varianten:** neuer Review oder Update, jeweils mit „nur Datenbanken und Register“ oder „mit anderen Methoden“ (Websites, Organisationen, Zitationssuche). Die Variante ergibt sich automatisch aus Projekt und Quellen, lässt sich aber manuell überschreiben.
- **Alle Zahlen werden aus den Daten abgeleitet** (siehe Abschnitt 5, Zähllogik).
- Trefferzahlen **pro Datenbank bzw. Register** statt nur als Summe (Fußnote * der Vorlage).
- Ausschlüsse durch Mensch und Automation getrennt (Fußnote **).
- **Drill-down:** Ein Klick auf eine Box zeigt die zugehörigen Datensätze.
- Bei einem Update werden die Zahlen aus dem vorherigen Review (Studien und Reports) manuell eingetragen, weil es dafür keine Daten gibt. Diese Felder sind als „manuell“ gekennzeichnet.
- **Export:** SVG, PNG (2x) und CSV der Zahlen. Die Beschriftung ist in DE oder EN wählbar, unabhängig von der Sprache der Oberfläche. Das Original ist Englisch, und die meisten Journals erwarten Englisch.
- Die Attribution (Page et al. 2021, CC BY 4.0) ist in jedem Export enthalten.

**Umsetzung (Meilenstein 5):**

- Beschriftung standardmäßig **Englisch** (Original); Deutsch ist eine als solche gekennzeichnete Arbeitsübersetzung (Hinweis im Diagramm, im Export und auf der Seite). Ausschlussgründe erscheinen so, wie sie im Projekt angelegt sind.
- **Varianten:** automatisch aus Review-Typ und Quellen („andere Methoden“, sobald eine Quelle der rechten Spalte einen Suchlauf hat), überschreibbar über `flowOverrides.variant`.
- Ausschlussgründe mit n = 0 werden nicht gezeichnet, stehen aber in der CSV.
- **Drill-down** per Klick oder Enter/Leertaste auf ein Kästchen; jede Zahl der Zahlentabelle hat einen eigenen Drill-down. Die Tabelle ist zugleich die **Textalternative** zum Diagramm (WCAG).
- **Export:** SVG mit eingebetteten Schriften, PNG (2x), CSV (UTF-8 mit BOM); die Hinweise * und ** der Vorlage richten sich an Autor:innen und erscheinen nicht im fertigen Diagramm.

### Modul 6: PRISMA-2020-Checkliste

- Alle 42 Einträge (27 Items mit Unterpunkten) aus `docs/reference/prisma2020-checklist.json`.
- Pro Item: Status (offen, erledigt, nicht zutreffend), **„wo berichtet“** (Freitext, z. B. „S. 12, Abschnitt 2.3“), Notiz.
- **Auto-Vorschläge aus Projektdaten:**
  - 5: Ein- und Ausschlusskriterien
  - 6: Liste aller Quellen mit Datum der letzten Suche
  - 7: Hinweis auf den Such-Anhang
  - 8: Anzahl der Reviewer:innen, Unabhängigkeit, eingesetzte Automation
  - 16a: Flow-Diagramm und Kennzahlen
  - 16b: Liste der im Volltext ausgeschlossenen Reports mit Grund
  - 24a und 24b: Registrierung und Protokoll
- Die Texte der Items gibt es auf Englisch (Original) und in einer deutschen Arbeitsübersetzung, **als Übersetzung gekennzeichnet**.
- **Export als PDF**, im Layout der offiziellen Checkliste, mit Spalte „Location where item is reported“.

**Umsetzung (Meilenstein 6):**

- Itemtexte in der Oberflächensprache; bei Deutsch steht der Hinweis „Inoffizielle Arbeitsübersetzung …“ (`translation.notice_de`) sichtbar über der Liste, und jedes Item kann den englischen Originaltext aufklappen (`lang="en"`).
- Vorschläge (Items 5, 6, 7, 8, 16a, 16b, 24a, 24b) werden nur auf Knopfdruck übernommen; stehen in „Wo berichtet“ oder „Notiz“ bereits andere Texte, fragt ein Dialog vorher. Übernommene Vorschläge setzen den Status auf „erledigt“ (außer „nicht zutreffend“). Item 8 weist die Einzelperson ohne unabhängige Zweitprüfung offen aus.
- PDF: Querformat Letter, vier Spalten wie das Original, Abschnittszeilen, Quellenzeile; Sprache wählbar (Standard Englisch). „Nicht zutreffend“ ohne Fundstelle erscheint als „Not applicable“.

### Exporte (querschnittlich)

| Export | Format | Version 1 |
|---|---|---|
| Gesamtes Projekt (Sicherung, Übertragung) | JSON mit `schemaVersion` | ✔ |
| Eingeschlossene Studien | RIS, CSV | ✔ |
| Alle Datensätze mit Status und Entscheidungen | CSV | ✔ |
| Suchdokumentation (PRISMA-S-Anhang) | PDF, Markdown | ✔ |
| Flow-Diagramm | SVG, PNG, CSV | ✔ |
| Checkliste | PDF | ✔ |
| Checkliste | DOCX | Version 2 |

**Umsetzung (Meilenstein 6):** zentrale Seite „Exporte“ (7. Navigationspunkt) plus kontextbezogene Buttons.

- **PDF-Bibliothek: `@react-pdf/renderer`** (MIT). Begründung: Zeilen- und Seitenumbruch, wiederholte Tabellenköpfe und Unicode-Schriften (IBM Plex Sans aus den lokal gebündelten Dateien) sind eingebaut; mit pdf-lib müsste all das selbst gebaut werden. Die Bibliothek wird nur beim Export nachgeladen (eigener Chunk). Beide Bibliotheken erzeugen ungetaggte PDFs; barrierefreie Alternativen sind die Ansicht in der App, der Markdown-Anhang und die CSV-Dateien.
- **CSV:** UTF-8 mit BOM, alle Zellen in Anführungszeichen, Trennzeichen wählbar (Standard Semikolon bei deutscher, Komma bei englischer Oberfläche), Schutz gegen Formel-Injection (führendes `=`, `+`, `@`).
- **RIS:** Umkehrung des eigenen RIS-Parsers; per Roundtrip-Test auf allen Fixtures geprüft. Die PMID steht als Notiz (`N1 - PMID: …`), weil es kein Standard-Tag gibt; die Studienzuordnung ebenfalls als Notiz. RIS enthält **keine Attribution** (Entscheidung vom 01.10.2026): RIS kennt keine Kommentare, ein Vermerk würde als Schein-Referenz in Zotero/Citavi landen.
- **Attribution** in allen übrigen Exporten: Checkliste und Datensatz-/Studien-CSV Page et al. 2021, Suchanhang Rethlefsen et al. 2021, jeweils CC BY 4.0.
- **Suchanhang:** Suchstrings unverändert (Markdown-Codeblock, dessen Zaun länger ist als jede Backtick-Folge im String), Limits in drei Zuständen („Keine Limits angewendet“ / „Nicht dokumentiert“ / Text).

### Projektverwaltung

- Mehrere Projekte pro Browser, mit Projektübersicht als Startseite. **Umsetzung (Meilenstein 7):** Die Startseite zeigt oben Logo, Slogan, Kurzbeschreibung, die Kette, die Einstiege „Neues Projekt“ und „Projekt öffnen“ (lädt eine Projektdatei) sowie den Hinweis „Ihre Daten bleiben in Ihrem Browser“; darunter die Projekte.
- Automatisches Speichern in IndexedDB.
- **Sicherungserinnerung:** Nach X Änderungen oder Y Tagen ohne JSON-Export erscheint ein Hinweis, weil Browserdaten gelöscht werden können. `navigator.storage.persist()` wird angefordert.
- Import eines Projekt-JSON, auch auf einem anderen Gerät.

## 4. Datenmodell (Entwurf)

```ts
type UUID = string;
type ISODate = string;

interface Project {
  id: UUID;
  schemaVersion: number;
  title: string;
  question: { text: string; framework: 'PICO' | 'PICo' | 'SPIDER' | 'free'; fields: Record<string, string> };
  reviewType: 'new' | 'update';
  eligibility: { inclusion: string[]; exclusion: string[] };
  exclusionReasons: ExclusionReason[];
  registration: { registry: string; id: string; url: string; protocolUrl: string };
  metadata: { author: string; institution: string; language: string };  // language = Sprache der Arbeit
  reviewers: Reviewer[];              // V1: genau eine Person, synchron mit metadata.author
  searchMeta: { filters?: string; priorWork?: string; updates?: string; peerReview?: string };
  flowOverrides?: { variant?: FlowVariant; previousStudies?: number; previousReports?: number };
  screening: { maybeToFullText: boolean; highlights: { include: string[]; exclude: string[] } };  // M4
  backup: { lastExportedAt?: ISODate; changesSinceExport: number };  // Sicherungserinnerung
  createdAt: ISODate; updatedAt: ISODate;
}

interface Reviewer { id: UUID; name: string; }
interface ExclusionReason { id: UUID; label: string; order: number; }

type SourceType = 'database' | 'register' | 'website' | 'search_engine'
                | 'citation_search' | 'contact' | 'other';

interface Source {                    // z. B. „Scopus“, „MEDLINE via Ovid“
  id: UUID; projectId: UUID;
  type: SourceType;
  name: string; platform?: string; url?: string;
  databases?: string[];               // gemeinsame Suche mehrerer Datenbanken auf einer Plattform (PRISMA-S Item 2)
}

interface SourceRun {                 // eine konkrete Ausführung einer Suche
  id: UUID; projectId: UUID; sourceId: UUID;
  date: DateOnly;                     // Kalenderdatum YYYY-MM-DD (lokaler Tag)
  dateTo?: DateOnly;                  // Ende eines Zeitraums (Websites, Zitationssuche, Kontakte, sonstige)
  searchString: string;               // vollständig, mehrzeilig, unverändert gespeichert
  limits?: string;
  noLimits?: boolean;                 // ausdrücklich „keine Limits“ ≠ leeres Feld („nicht dokumentiert“)
  reportedHits?: number;              // laut Datenbank
  tool?: string;                      // z. B. 'OpenAlex API', 'Publish or Perish'
  method?: 'search' | 'browse';       // Websites
  recordsChecked?: number;            // Suchmaschinen: Anzahl geprüfter Treffer
  citationDirection?: 'backward' | 'forward' | 'both';
  seedDocuments?: string;             // Zitationssuche: Ausgangsdokumente
  description?: string;               // Kontakte, sonstige Methoden
  notes?: string;
  importNote?: string;                // Begründung bei Abweichung gemeldet ↔ importiert (M3)
}

interface ImportBatch {               // eine importierte Datei (M3)
  id: UUID; projectId: UUID; sourceRunId: UUID;
  fileName: string; format: 'ris' | 'nbib' | 'bibtex' | 'csv';
  importedAt: ISODate; recordCount: number;
  warnings: { code: string; line?: number; detail?: string }[];
}

interface BibRecord {             // nicht 'Record' – Kollision mit TS-Utility-Typ
  id: UUID; projectId: UUID;
  sourceRunId: UUID;
  importBatchId: UUID;                // M3: Import als Ganzes rückgängig machbar
  sourceLine?: number;                // Zeile in der Importdatei
  csl: CSLJSON;                       // normalisierte bibliografische Daten
  raw: string;                        // Originaleintrag aus der Importdatei
  doi?: string; pmid?: string;        // normalisiert, für Dedup indiziert
  duplicateGroupId?: UUID;
}

interface DuplicateGroup {             // abgeleitet aus Datensätzen + DedupDecisions
  id: UUID; projectId: UUID; primaryRecordId: UUID; memberIds: UUID[];
  rule: 'doi' | 'pmid' | 'title-fuzzy' | 'manual';   // stärkste Regel der Gruppe
  links: { a: UUID; b: UUID; rule: DuplicateRule; score?: number }[];  // jede Verbindung erklärt
  score?: number; confirmedAt?: ISODate;
}

interface DedupDecision {             // append-only, je Paar gilt die letzte (M3)
  id: UUID; projectId: UUID; recordIds: UUID[];
  value: 'merge' | 'separate' | 'reset' | 'primary';
  reviewerId: UUID; timestamp: ISODate;
}

interface Decision {                  // append-only (M4: bezieht sich auf eine Screening-Einheit)
  id: UUID; projectId: UUID; reviewerId: UUID;
  recordIds: UUID[];                  // alle Mitglieder der Einheit zum Zeitpunkt der Entscheidung
  shownRecordId: UUID;                // der angezeigte (Primär-)Datensatz
  stage: 'pre_screening' | 'title_abstract' | 'full_text';
  value: 'include' | 'exclude' | 'maybe' | 'not_retrieved'
       | 'remove_automation' | 'remove_other' | 'reset';
  reasonId?: UUID; note?: string;     // note Pflicht bei remove_*
  studyId?: UUID;                     // Stufe 2 include: Report gehört zu dieser Studie
  undoOf?: UUID;                      // „Z“: dieser Eintrag macht jenen rückgängig
  timestamp: ISODate;
}

interface Study { id: UUID; projectId: UUID; label: string; }

interface ChecklistEntry {
  projectId: UUID;
  itemId: string;                     // '1', '10a', '16b' …
  status: 'open' | 'done' | 'na';
  location?: string; note?: string;
}

type FlowVariant = 'new_db' | 'new_db_other' | 'update_db' | 'update_db_other';
```

### Änderungen gegenüber dem ersten Entwurf (Meilenstein 1)

| Änderung | Begründung |
|---|---|
| `projectId` an jeder Entität | Export, Import und kaskadierendes Löschen über einen Index; keine verwaisten Datensätze |
| `question.text` | Die Forschungsfrage selbst; die Framework-Felder strukturieren sie nur optional |
| `metadata { author, institution, language }` | Modul 1 verlangt diese Angaben; `language` ist die Sprache der Arbeit, nicht der Oberfläche |
| Autor:in = Reviewer:in (V1) | Ein Feld in der UI, intern getrennt (`metadata.author`, `reviewers[0]`) – Teams später ohne Migration |
| `registration` immer vorhanden (leere Strings) | Einfachere Formulare; leer = nicht registriert |
| `backup { lastExportedAt, changesSinceExport }` | Sicherungserinnerung nach **7 Tagen oder 50 Änderungen** seit dem letzten Export (ohne Export: seit Anlage) |

Standard-Ausschlussgründe bei neuen Projekten (in der Oberflächensprache angelegt, danach Nutzerdaten): falsche Population, falsche Intervention bzw. Exposition, falsches Studiendesign, falsches Outcome, falscher Publikationstyp, falsche Sprache, falscher Zeitraum.

### Änderungen in Meilenstein 2 (Suchdokumentation)

| Entscheidung | Begründung |
|---|---|
| **Eine Quelle pro gemeinsam ausgeführter Suche**, `Source.databases` listet die enthaltenen Datenbanken | Eine Suche über z. B. CINAHL und ERIC auf EBSCOhost liefert eine gemischte Trefferliste; eine Aufteilung pro Datenbank wäre nicht belegbar (PRISMA-S Item 2) |
| **Suchmaschinen (z. B. Google Scholar) in der linken Spalte** des Flow-Diagramms („Datenbanken und Register“) | Entspricht der üblichen Berichtspraxis (Entscheidung vom 30.09.2026); die Zuordnung liegt an einer Stelle (`flowColumn()` in `src/domain/search/sourceTypes.ts`) |
| Typspezifische Felder am `SourceRun` (`method`, `recordsChecked`, `citationDirection`, `seedDocuments`, `description`) | Pflichtfelder laut Tabelle in Modul 2 |
| Optionales `dateTo` für Websites, Zitationssuche, Kontakte und sonstige Methoden | Solche Suchen erstrecken sich oft über Tage oder Wochen; „letzte Suche“ = Ende des Zeitraums |
| Suchdatum als Kalenderdatum (`YYYY-MM-DD`, lokaler Tag) | Ein Suchdatum ist ein Tag, kein Zeitpunkt; UTC würde Suchen nach Mitternacht auf den Vortag legen |
| Suchläufe, aus denen Datensätze importiert wurden, sind nicht löschbar | Schützt die Kette Suche → Treffer |
| Quellen und Suchläufe werden explizit gespeichert (Formular), projektweite Angaben automatisch | Ein halb ausgefüllter Suchlauf soll nicht als Datensatz in der Kette landen |

Pflichtfelder weichen an zwei Stellen bewusst von der Tabelle in Modul 2 ab (bestätigt am 01.10.2026):

- **Limits und Filter** sind optional, es werden aber drei Zustände unterschieden (PRISMA-S Item 9): dokumentierte Limits (Text), ausdrücklich **„Keine Limits angewendet“** (Checkbox, `noLimits: true`) und **„nicht dokumentiert“** (Feld leer, Checkbox nicht gesetzt). Ist die Checkbox gesetzt, wird ein evtl. noch vorhandener Text nicht gespeichert. Die Suchübersicht zeigt den Zustand je Suchlauf. Im Export der Suchdokumentation (Meilenstein 6) erscheint „Keine Limits angewendet“ als Text, ein leeres Feld als Hinweis „nicht dokumentiert“; die Zuordnung liegt in `limitsStatus()` (`src/domain/search/summary.ts`).
- Die **Trefferzahl** ist bei Zitationssuche, Kontakten und sonstigen Methoden optional. Die Zahlen für das Flow-Diagramm stammen dort aus den importierten Datensätzen.

### Änderungen in Meilenstein 3 (Import & Deduplizierung)

| Entscheidung | Begründung |
|---|---|
| Neue Entität **`ImportBatch`** (eine Datei), `BibRecord.importBatchId` und `sourceLine` | Ein Import lässt sich als Ganzes rückgängig machen (solange keine Screening-Entscheidungen existieren); Warnungen verweisen auf Zeilen der Originaldatei |
| Mehrere Dateien pro Suchlauf | Datenbanken begrenzen Exporte (z. B. 2 000 Datensätze); der Abgleich summiert alle Dateien eines Suchlaufs |
| Abgleich gemeldet ↔ importiert: Begründung (`SourceRun.importNote`) ist Pflicht bei Abweichung, außer die Nutzerin gibt an, dass **weitere Dateien folgen** (nur solange importiert < gemeldet) | Teilexporte sollen nicht zu Scheinbegründungen zwingen; die Abweichung bleibt bis zur Begründung sichtbar (`reconcile()`) |
| **`DedupDecision`** (append-only) statt manuell gepflegter Gruppen; `DuplicateGroup` wird aus Datensätzen und Entscheidungen **abgeleitet** (`deduplicate()`) und mit stabilen IDs gespeichert | Nachvollziehbarkeit (Prinzip 4): jede Gruppe ist reproduzierbar, jede Entscheidung trägt `reviewerId` und ist rücknehmbar |
| `DuplicateGroup.links` | Jede Verbindung in einer Gruppe ist mit Regel und ggf. Ähnlichkeitswert erklärt |
| Primärdatensatz = **vollständigster Datensatz** (DOI, PMID, Abstract, Autor:innen …), manuell änderbar | Das Screening zeigt den informativsten Eintrag |
| Eigener RIS-Parser, citation-js nur für BibTeX, Papa Parse für CSV | Datenbankspezifische RIS-Eigenheiten (Scopus `C2` = PMID, `AN` bei PubMed) brauchen eigene Regeln |
| **Verschoben auf M4:** manuelle Zusammenführung beliebiger Datensätze, „vor dem Screening entfernt“ | Beides gehört in die Datensatzliste des Screenings |

**Dedup-Regeln (`src/domain/dedup/dedup.ts`):**

1. Gleiche normalisierte DOI → automatisch zusammengeführt (`doi`).
2. Gleiche PMID → automatisch zusammengeführt (`pmid`).
3. **Kandidat** (`title-fuzzy`, nie automatisch): normalisierte Titel (Kleinschreibung, ohne Satzzeichen und Diakritika, Umlaute transliteriert) mit Levenshtein-Ähnlichkeit **≥ 0,90**, Jahr ±1 und gleiche:r Erstautor:in (fehlende Angaben gelten als unbekannt, nicht als Widerspruch). Unterschiedliche DOIs werden als Warnung angezeigt (Preprint vs. Zeitschrift, Doppelpublikation).
4. Errata („Correction to: …“) werden nie mit dem Original gepaart.
5. Bestätigte Kandidaten werden zu `manual`-Verbindungen; „Getrennt lassen“ ist ebenso protokolliert und rücknehmbar. Auch automatische Zusammenführungen lassen sich lösen.

**Begründung des Schwellenwerts 0,90** (Testdaten `tests/fixtures/real/`, 419 Datensätze aus vier Quellen): Alle 142 über DOI belegten Dubletten erreichen eine Titelähnlichkeit ≥ 0,99, die ähnlichsten Nicht-Dubletten ≤ 0,72. 0,90 lässt Raum für Schreibvarianten (britisch/amerikanisch, Transliteration, Untertitel-Satzzeichen), ohne dass unterschiedliche Arbeiten vorgeschlagen werden. Ergebnis auf den Echtdaten: 139 Gruppen (138 DOI, 1 PMID), 141 Dubletten entfernt, 278 eindeutige Datensätze, 2 Kandidaten (PRISMA-S in Syst Rev und JMLA; Parallelausgabe von Enfermería Intensiva).

**Leistung:** Blocking nach Erstautor:in und gleitendes Fenster (10) über sortierte Titel, Levenshtein mit Abbruchgrenze; Berechnung im Web Worker.

### Änderungen in Meilenstein 4 (Screening)

**Kernproblem:** Entscheidungen müssen stabil bleiben, wenn sich die Dublettenstruktur nach Screening-Beginn ändert. Gruppen-IDs folgen dem Primärdatensatz (`assignGroupIds`) und sind daher kein stabiler Bezug.

| Entscheidung | Begründung |
|---|---|
| `Decision.recordIds` (alle Mitglieder der Einheit) und `shownRecordId` statt `recordId` | Datensatz-IDs ändern sich nie; Zusammenführen, Aufteilen und Primärwechsel schreiben keine Entscheidung um |
| **Screening-Einheiten** (Dublettengruppe oder Einzeldatensatz) werden wie die Gruppen beim Lesen abgeleitet (`src/domain/screening/`) | Eine Regel statt Umschreib-Code bei jeder Dedup-Änderung |
| „Vor dem Screening entfernt“ ist eine Entscheidung (`stage: 'pre_screening'`), kein Feld am Datensatz; `BibRecord.removedBeforeScreening` und `BibRecord.studyId` entfallen | Protokolliert und rücknehmbar; beide Felder wurden nie befüllt |
| Report → Studie über `studyId` an der Stufe-2-Einschlussentscheidung; ohne Zuordnung 1 Report = 1 Studie | Umhängen ist eine neue Entscheidung und damit im Audit-Trail |
| „Z“ hängt einen Eintrag mit `undoOf` an, der den vorherigen Zustand herstellt (oder `reset`) | Append-only, nichts wird gelöscht |
| `Project.screening` (Vielleicht in Stufe 2 mitnehmen, Suchbegriffe); Tastenkürzel und Hervorhebung an/aus pro Browser | Projekteinstellung vs. Gerätepräferenz |
| Ausschlussgründe, auf die eine Entscheidung verweist, sind nicht löschbar (umbenennen geht) | Audit-Trail und Flow-Zählung nach `reasonId` |
| Kein automatischer OA-Abruf bei OpenAlex, nur Links (DOI, Unpaywall, OpenAlex, PubMed) | Prinzip 1: Datenübertragung nur bei aktiver Suche; API-Anbindung in M7 |

**Regel für den Status einer Einheit (je Stufe):** Für jedes Mitglied gilt dessen letzte Entscheidung (`reset` = keine). Sie zählt, wenn der damals angezeigte Datensatz in der Einheit liegt; sonst ist sie nur ein **Vorschlag**. Keine zählende Entscheidung → offen; alle stimmen überein → entschieden; Widerspruch → **Konflikt** (zählt als offen, steht oben). In Stufe 1 zählt dabei nur der Wert, in Stufe 2 auch Ausschlussgrund und Studie.

| Fall (bestätigt am 01.10.2026) | Verhalten |
|---|---|
| 1 Primärwechsel | Status unverändert |
| 2 Zusammenführen | Gleiche Entscheidungen → übernommen; entschieden + offen → übernommen; widersprechend → Konflikt, eine neue Entscheidung löst ihn |
| 3 Aufteilen | Der Teil mit dem angezeigten Datensatz behält die Entscheidung; abgespaltene Teile sind **offen mit Vorschlag** („Nach Aufteilung prüfen“), Übernahme per Klick oder Taste wird protokolliert. Begründung: Ein abgespaltener Datensatz ist eine andere Publikation, die nie gesehen wurde |
| 4 Entfernt | Entscheidung bleibt in der Historie, zählt nicht; „Import rückgängig“ ist gesperrt, sobald eine Entscheidung auf einen Datensatz des Imports verweist (geerbte Entscheidungen sperren nicht) |
| 5 Nachimport | Erkannte Dubletten entschiedener Einheiten erben deren Status, alles andere ist offen |

Weitere Regeln: Einheiten **nur** aus anderen Methoden (Websites, Zitationssuche, Kontakte, sonstige) gehen direkt in Stufe 2; ist ein Datensatz aus Datenbank, Register oder Suchmaschine dabei, durchläuft die Einheit Stufe 1. Stufe 2 ist gesperrt, solange es „Vielleicht“ gibt (außer per Einstellung mitgenommen); unentschiedene Stufe-1-Datensätze erzeugen nur eine Warnung. Ändert sich die Stufe-1-Entscheidung nachträglich, bleibt eine Stufe-2-Entscheidung in der Historie, zählt aber nicht.

### Änderungen in Meilenstein 7 (OpenAlex)

| Entscheidung | Begründung |
|---|---|
| `ImportBatch.format` kennt zusätzlich `'openalex'`; `fileName` enthält dann die Abfrage-URL (ohne E-Mail-Adresse und Key) | Die Herkunft eines OpenAlex-Imports ist eine Anfrage, keine Datei. Rein additiv: bestehende Daten ändern sich nicht, daher **kein Versionssprung**; die Validierung des Projekt-JSON ist nachgezogen |
| Keine neue Tabelle, keine Dexie-Version | Quelle, Suchlauf, Importdatei und Datensätze nutzen das bestehende Modell |
| `mailto` und API-Key nicht im Datenmodell | Persönliche Angaben gehören nicht in ein Projekt, das weitergegeben wird |

### Wann steigt `schemaVersion`?

`schemaVersion` steigt, sobald **bestehende Daten transformiert werden müssen** (Umbenennen, Umstrukturieren, geänderte Bedeutung). Rein additive, optionale Felder ohne vorhandene Daten brauchen keinen Versionssprung. Meilenstein 2 bleibt daher bei Version 1: `sources` und `sourceRuns` waren in allen bisherigen Exporten leer. **Meilenstein 3 hebt auf Version 2:** Die Migration 1 → 2 ergänzt die Sammlungen `importBatches` und `dedupDecisions` (leer); Datensätze gab es vorher nicht. Die Browser-Datenbank (Dexie) steht auf Version 2 mit den Tabellen `importBatches`, `dedupDecisions` und dem Index `records.importBatchId`. **Meilenstein 4 hebt auf Version 3:** Die Migration 2 → 3 wandelt `recordId` in `recordIds: [recordId]` und `shownRecordId`, entfernt die ungenutzten Datensatz-Felder `studyId` und `removedBeforeScreening` und ergänzt `project.screening` mit Standardwerten; Dexie Version 3 macht dasselbe in der Browser-Datenbank (Multi-Entry-Index `decisions.*recordIds`). `SourceRun.noLimits` ist ein additives, optionales Feld ohne Versionssprung. Bis dahin leere Limits-Felder gelten als „nicht dokumentiert“; ob damit „keine Limits“ gemeint war, lässt sich nicht automatisch ableiten und muss bei Bedarf per Checkbox nachgetragen werden.

### Austauschformat (Projekt-JSON)

```json
{
  "format": "facet-review-project",
  "schemaVersion": 3,
  "exportedAt": "2026-09-30T12:00:00.000Z",
  "app": { "name": "Facet Review", "version": "0.0.0" },
  "project": { … },
  "sources": [], "sourceRuns": [], "importBatches": [], "records": [],
  "duplicateGroups": [], "dedupDecisions": [],
  "decisions": [], "studies": [], "checklist": []
}
```

- `schemaVersion` versioniert das **Austauschformat**; die Dexie-Version der Browser-Datenbank ist davon unabhängig.
- Import: Dateien älterer Versionen durchlaufen die Migrationskette (`src/domain/exchange/migrations.ts`), Dateien einer **neueren** App-Version werden mit Hinweis abgelehnt. Fehler werden mit JSON-Pfad gemeldet, nie mit Absturz.
- Existiert die Projekt-ID bereits, wählt die Nutzerin „Ersetzen“ oder „Als Kopie importieren“ (alle IDs werden neu vergeben, Verweise bleiben konsistent).

**Hinweis für die Umsetzung:** Das Modell ist ein Entwurf. Änderungen sind erlaubt, wenn sie begründet und im PRD nachgetragen werden. Nicht verhandelbar sind die append-only Entscheidungen mit `reviewerId`, die Herkunft jedes Datensatzes (`sourceRunId`) und `schemaVersion`.

## 5. Zähllogik Flow-Diagramm

„Letzte Entscheidung“ meint ab Meilenstein 4 den abgeleiteten Status der Screening-Einheit (siehe Abschnitt 4, Änderungen in Meilenstein 4); Konflikte zählen als offen.

Alle Werte werden in `src/domain/flow/` als reine Funktion `computeFlow(projectData) → FlowCounts` berechnet und mit Fixtures getestet.

| Box (PRISMA 2020) | Ableitung |
|---|---|
| Records identified from databases (n, pro Datenbank) | Summe der importierten Datensätze aus `SourceRun`s mit `type ∈ {database, search_engine}`; eine gemeinsame Suche über mehrere Datenbanken erscheint als **eine** Zeile, z. B. „EBSCOhost (CINAHL, ERIC)“ |
| … from registers | dto. mit `type = register` |
| Duplicate records removed | Anzahl der Nicht-Primär-Mitglieder aller `DuplicateGroup`s |
| Records marked as ineligible by automation tools | Einheiten mit `pre_screening`-Entscheidung `remove_automation` |
| Records removed for other reasons | Einheiten mit `pre_screening`-Entscheidung `remove_other` |
| Records screened | Eindeutige Datensätze (Primär bzw. ohne Gruppe), nicht vorher entfernt, aus Datenbanken und Registern |
| Records excluded | Letzte Entscheidung in Stufe 1 = `exclude` |
| Reports sought for retrieval | Letzte Entscheidung in Stufe 1 = `include` (bzw. `maybe`, wenn so eingestellt) |
| Reports not retrieved | Letzte Entscheidung in Stufe 2 = `not_retrieved` |
| Reports assessed for eligibility | sought − not retrieved |
| Reports excluded: Reason n | Letzte Entscheidung in Stufe 2 = `exclude`, gruppiert nach `reasonId` |
| Reports of included studies | Letzte Entscheidung in Stufe 2 = `include` |
| Studies included in review | Anzahl verschiedener `studyId` an den Stufe-2-Einschlussentscheidungen (ohne Zuordnung: 1 Report = 1 Studie; `includedCounts()` in `src/domain/screening/studies.ts`) |
| Rechte Spalte „other methods“ | Analog für Quellen mit `type ∈ {website, citation_search, contact, other}`; hier wird ab „Reports sought“ gezählt, weil die PRISMA-Vorlage dort kein Titel-Screening vorsieht |

**Präzisierungen (Meilenstein 5, `computeFlow()` in `src/domain/flow/`):**

- Gezählt wird auf den Screening-Einheiten aus Meilenstein 4; Konflikte und abgespaltene Teile („nach Aufteilung prüfen“) zählen als offen.
- **Linke Spalte:** Datenbanken einschließlich Suchmaschinen (M2-Entscheidung), Register getrennt, jeweils pro Quelle. Dubletten = Σ (Datensätze aus linken Quellen je Einheit − 1); damit gilt identified − duplicates = Einheiten auch dann, wenn ein Datensatz aus anderen Methoden in einer linken Einheit steckt.
- **Rechte Spalte (andere Methoden):** identifiziert pro Methodentyp (Websites, Organisationen = Kontakte, Zitationssuche, sonstige). Ab „Reports sought“ zählen nur Einheiten, die **ausschließlich** aus anderen Methoden stammen. Datensätze, die Dubletten eines Datenbank-Datensatzes sind, werden links berichtet und rechts als Hinweis „davon auch über Datenbanken oder Register gefunden“ ausgewiesen; Dubletten innerhalb der anderen Methoden ebenfalls als Hinweis (die Vorlage hat dafür kein Kästchen).
- „Vielleicht“ ohne Mitnahme in Stufe 2 zählt als offen in Stufe 1.
- Studien: verschiedene `studyId` über beide Spalten; ohne Zuordnung 1 Report = 1 Studie. Update: Gesamt = vorherige (manuell) + neue.

**Konsistenzprüfungen** (als Warnung in der UI anzeigen; offene Einheiten → „Screening unvollständig“, jede andere Abweichung → Fehler):

- identified − duplicates − removed = screened
- screened = excluded + sought (+ offene Datensätze, als Warnung „Screening unvollständig“)
- sought = not retrieved + assessed
- assessed = excluded (Summe aller Gründe) + included (+ offene)

## 6. Nicht-funktionale Anforderungen

- **Performance:** 10.000 Datensätze pro Projekt ohne spürbare Verzögerung beim Screening (Virtualisierung von Listen, Deduplizierung im Web Worker).
- **Datenschutz:** Kein Datenversand außer an OpenAlex bei aktiver Suche. Die Datenschutzerklärung ist entsprechend kurz.
  - **Content Security Policy (spätestens Meilenstein 7):** Das Versprechen „kein Datenversand außer an OpenAlex“ wird technisch erzwungen, nicht nur zugesagt. Weil GitHub Pages keine eigenen HTTP-Header erlaubt, wird die CSP als `<meta http-equiv="Content-Security-Policy">` in `index.html` gesetzt, mindestens mit `default-src 'self'` und `connect-src 'self' https://api.openalex.org`; Schriften, Skripte, Styles und Bilder nur aus `'self'` (bzw. `data:`/`blob:`, wo für Exporte nötig). Ein E2E-Test prüft, dass die Policy greift. Die CSP ist auch ein Argument gegenüber Hochschulen und Datenschutzbeauftragten.
  - **Umsetzung (Meilenstein 7):** Die Policy steht in `src/app/csp.ts` und wird nur im Build als `<meta>` in `index.html` (und damit `404.html`) geschrieben: `default-src 'self'; connect-src 'self' https://api.openalex.org; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. `'wasm-unsafe-eval'` braucht der PDF-Export (Layout-Engine Yoga als WebAssembly); es erlaubt kein `eval()`. Die PDF-Bibliothek versucht zunächst, ihr WebAssembly per `fetch()` aus einer eingebetteten `data:`-URL zu laden; die Policy blockiert das bewusst (`connect-src` bleibt exakt `'self'` und OpenAlex), die Bibliothek dekodiert dieselben Bytes dann im Speicher. E2E-Tests prüfen, dass fremde `fetch`-, Beacon-, Bild- und Skript-Anfragen blockiert werden, OpenAlex erreichbar ist und ein Rundgang durch alle Module und Exporte keine fremde Anfrage auslöst. `frame-ancestors` lässt sich per `<meta>` nicht setzen.
  - **Hosting-Hinweis für die Datenschutzerklärung:** Die App wird über GitHub Pages (GitHub Inc., USA) unter facetreview.org ausgeliefert. Beim Seitenaufruf verarbeitet GitHub technisch notwendige Verbindungsdaten, insbesondere die IP-Adresse. Das ist kein Tracking durch die App, muss aber in der Datenschutzerklärung benannt werden (inkl. Verweis auf die GitHub-Datenschutzbestimmungen).
- **Barrierefreiheit:** WCAG 2.1 AA, vollständige Tastaturbedienung, sichtbarer Fokus, Kontraste ≥ 4.5:1. Audit in Meilenstein 7: [`docs/a11y-audit.md`](a11y-audit.md), automatisiert in `tests/e2e/a11y.spec.ts`.
- **Browser:** Aktuelle Versionen von Chrome, Edge, Firefox und Safari.
- **Offline:** Als PWA installierbar (Meilenstein 7). Ohne Netz funktioniert alles außer der OpenAlex-Suche. **Umsetzung:** `vite-plugin-pwa` (Workbox, `generateSW`) speichert den gesamten Build vorab, auch die nachgeladene PDF-Engine, den Import-Worker und alle Schriften; Navigationen fallen auf `index.html` zurück (Deep Links offline). OpenAlex wird nie zwischengespeichert. Eine neue Version wird nur angekündigt („Jetzt neu laden“ / „Später“), nie ungefragt aktiviert – auch nicht mitten im Screening.
- **Rechtliches:** Seiten „Impressum“ (`/impressum`) und „Datenschutz“ (`/datenschutz`), verlinkt in der Fußzeile. Die Inhalte liefert der Autor; bis dahin stehen markierte Platzhalter und ein automatischer Entwurfshinweis. Die Datenschutzseite enthält bereits den Hosting-Hinweis (GitHub Pages), die OpenAlex-Suche, die lokale Speicherung und die CSP.
- **Robustheit:** Beschädigte Importdateien führen zu verständlichen Fehlermeldungen mit Zeilenangabe, nie zu einem Absturz.

## 7. Roadmap

### Version 1 – Meilensteine

| # | Meilenstein | Ergebnis |
|---|---|---|
| 0 | Setup | Vite, React, TS, ESLint, Prettier, Vitest, Playwright, i18n-Gerüst, Design-Tokens, Layout, AGPL-Lizenz, README, CONTRIBUTING |
| 1 | Datenmodell & Projekte | Dexie-Schema, Projektübersicht, Projekt anlegen und bearbeiten (Modul 1), JSON-Export und -Import mit `schemaVersion` |
| 2 | Suchdokumentation | Modul 2 ohne OpenAlex |
| 3 | Import & Deduplizierung | Parser (RIS, BibTeX, nbib, CSV) mit Tests und Fixtures, Deduplizierung mit Review-Ansicht |
| 4 | Screening | Stufen 1 und 2, Tastatursteuerung, Ausschlussgründe, Report-Studie-Zuordnung |
| 5 | Flow-Diagramm | `computeFlow` mit Tests, SVG-Rendering in vier Varianten, Drill-down, Export |
| 6 | Checkliste & Exporte | Modul 6, PDF-Exporte, RIS- und CSV-Exporte, PRISMA-S-Anhang |
| 7 | OpenAlex, PWA & Feinschliff | OpenAlex-Suche, PWA, Content Security Policy, Datenschutzerklärung, a11y-Audit, Englisch vervollständigen, Startseite mit Logo |

### Version 2 und später (im Datenmodell schon mitgedacht)

- Stichproben-Export für eine Zweitprüfung und Cohens Kappa
- Team-Screening (mehrere Reviewer:innen, Konfliktauflösung), gegebenenfalls mit optionalem Sync-Backend
- DOCX-Export der Checkliste
- PRISMA-S-Checkliste als eigene Ansicht (16 Items)
- PRISMA 2020 für Abstracts (Item 2)
- Zotero-Anbindung (Import und Export über Zotero-API bzw. Better BibTeX)
- Optionale KI-gestützte Vorsortierung, transparent als „Automation-Tool“ gezählt
- Weitere Import-Formate (EndNote XML, Web-of-Science-Tagged, Scopus-CSV-Presets)

## 8. Referenzen

- Page MJ, McKenzie JE, Bossuyt PM, et al. *The PRISMA 2020 statement: an updated guideline for reporting systematic reviews.* BMJ 2021;372:n71. doi:10.1136/bmj.n71
- Rethlefsen ML, Kirtley S, Waffenschmidt S, et al. *PRISMA-S: an extension to the PRISMA Statement for Reporting Literature Searches in Systematic Reviews.* Syst Rev 2021;10:39. doi:10.1186/s13643-020-01542-z
- Gusenbauer M, Haddaway NR. *Which academic search systems are suitable for systematic reviews or meta-analyses?* Res Synth Methods 2020;11(2):181–217. doi:10.1002/jrsm.1378
- https://www.prisma-statement.org/
- OpenAlex API: https://docs.openalex.org/

Die Vorlagen in `docs/reference/` stehen unter CC BY 4.0 (Quelle: Page MJ, et al. BMJ 2021;372:n71).
