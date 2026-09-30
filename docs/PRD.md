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

**Export:** Die Suchdokumentation lässt sich als Anhang für die Arbeit exportieren (PDF und Markdown), einschließlich der vollständigen Suchstrings aller Quellen (Item 8).

### Modul 3: Import & Deduplizierung

**Import pro Quelle bzw. Ausführung:** RIS, BibTeX, .nbib, CSV (mit Spalten-Mapping-Dialog).

- Jeder importierte Datensatz behält seine **Herkunft** (`sourceRunId`) und die Rohdaten (`raw`).
- **Abgleich:** Die gemeldete Trefferzahl wird mit der importierten Anzahl verglichen. Bei Abweichung erscheint eine Warnung, die Nutzerin kann sie bewusst bestätigen und begründen.

**Deduplizierung:**

1. Exakte Übereinstimmung der normalisierten DOI.
2. Exakte Übereinstimmung der PMID.
3. Normalisierter Titel (Kleinschreibung, ohne Satzzeichen, ohne Diakritika), Jahr ±1 und erster Autor: Ähnlichkeitswert (z. B. Jaro-Winkler oder Levenshtein-Ratio). Ab einem Schwellenwert wird das Paar als **Kandidat** zur manuellen Bestätigung vorgeschlagen.
4. Sichere Treffer (1 und 2) werden automatisch zusammengeführt, aber **rückgängig gemacht werden kann das jederzeit.**
5. Jede Zusammenführung bildet eine `DuplicateGroup` mit einem Primärdatensatz und protokollierter Regel (`rule: 'doi' | 'pmid' | 'title-fuzzy' | 'manual'`).

**Automatisierung und sonstige Entfernungen vor dem Screening:** Datensätze können mit Begründung als „vor dem Screening entfernt“ markiert werden, mit der Unterscheidung „durch Automation-Tool“ bzw. „aus anderem Grund“ (eigene Boxen im Flow-Diagramm).

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

### Projektverwaltung

- Mehrere Projekte pro Browser, mit Projektübersicht als Startseite.
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
}

interface SourceRun {                 // eine konkrete Ausführung einer Suche
  id: UUID; projectId: UUID; sourceId: UUID;
  date: ISODate;
  searchString: string;               // vollständig, mehrzeilig
  limits?: string;
  reportedHits?: number;              // laut Datenbank
  tool?: string;                      // z. B. 'OpenAlex API', 'Publish or Perish'
  notes?: string;
}

interface BibRecord {             // nicht 'Record' – Kollision mit TS-Utility-Typ
  id: UUID; projectId: UUID;
  sourceRunId: UUID;
  csl: CSLJSON;                       // normalisierte bibliografische Daten
  raw: string;                        // Originaleintrag aus der Importdatei
  doi?: string; pmid?: string;        // normalisiert, für Dedup indiziert
  removedBeforeScreening?: { by: 'automation' | 'other'; reason: string };
  duplicateGroupId?: UUID;
  studyId?: UUID;                     // Zuordnung Report → Studie
}

interface DuplicateGroup {
  id: UUID; projectId: UUID; primaryRecordId: UUID; memberIds: UUID[];
  rule: 'doi' | 'pmid' | 'title-fuzzy' | 'manual';
  score?: number; confirmedAt?: ISODate;
}

interface Decision {                  // append-only
  id: UUID; projectId: UUID; recordId: UUID; reviewerId: UUID;
  stage: 'title_abstract' | 'full_text';
  value: 'include' | 'exclude' | 'maybe' | 'not_retrieved';
  reasonId?: UUID; note?: string;
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

### Austauschformat (Projekt-JSON)

```json
{
  "format": "facet-review-project",
  "schemaVersion": 1,
  "exportedAt": "2026-09-30T12:00:00.000Z",
  "app": { "name": "Facet Review", "version": "0.0.0" },
  "project": { … },
  "sources": [], "sourceRuns": [], "records": [], "duplicateGroups": [],
  "decisions": [], "studies": [], "checklist": []
}
```

- `schemaVersion` versioniert das **Austauschformat**; die Dexie-Version der Browser-Datenbank ist davon unabhängig.
- Import: Dateien älterer Versionen durchlaufen die Migrationskette (`src/domain/exchange/migrations.ts`), Dateien einer **neueren** App-Version werden mit Hinweis abgelehnt. Fehler werden mit JSON-Pfad gemeldet, nie mit Absturz.
- Existiert die Projekt-ID bereits, wählt die Nutzerin „Ersetzen“ oder „Als Kopie importieren“ (alle IDs werden neu vergeben, Verweise bleiben konsistent).

**Hinweis für die Umsetzung:** Das Modell ist ein Entwurf. Änderungen sind erlaubt, wenn sie begründet und im PRD nachgetragen werden. Nicht verhandelbar sind die append-only Entscheidungen mit `reviewerId`, die Herkunft jedes Datensatzes (`sourceRunId`) und `schemaVersion`.

## 5. Zähllogik Flow-Diagramm

Alle Werte werden in `src/domain/flow/` als reine Funktion `computeFlow(projectData) → FlowCounts` berechnet und mit Fixtures getestet.

| Box (PRISMA 2020) | Ableitung |
|---|---|
| Records identified from databases (n, pro Datenbank) | Summe der importierten Datensätze aus `SourceRun`s mit `type = database` |
| … from registers | dto. mit `type = register` |
| Duplicate records removed | Anzahl der Nicht-Primär-Mitglieder aller `DuplicateGroup`s |
| Records marked as ineligible by automation tools | `removedBeforeScreening.by = 'automation'` |
| Records removed for other reasons | `removedBeforeScreening.by = 'other'` |
| Records screened | Eindeutige Datensätze (Primär bzw. ohne Gruppe), nicht vorher entfernt, aus Datenbanken und Registern |
| Records excluded | Letzte Entscheidung in Stufe 1 = `exclude` |
| Reports sought for retrieval | Letzte Entscheidung in Stufe 1 = `include` (bzw. `maybe`, wenn so eingestellt) |
| Reports not retrieved | Letzte Entscheidung in Stufe 2 = `not_retrieved` |
| Reports assessed for eligibility | sought − not retrieved |
| Reports excluded: Reason n | Letzte Entscheidung in Stufe 2 = `exclude`, gruppiert nach `reasonId` |
| Reports of included studies | Letzte Entscheidung in Stufe 2 = `include` |
| Studies included in review | Anzahl verschiedener `studyId` unter den eingeschlossenen Reports (ohne Zuordnung: 1 Report = 1 Studie) |
| Rechte Spalte „other methods“ | Analog für Quellen mit `type ∈ {website, search_engine, citation_search, contact, other}`; hier wird ab „Reports sought“ gezählt, weil die PRISMA-Vorlage dort kein Titel-Screening vorsieht |

**Konsistenzprüfungen** (als Warnung in der UI anzeigen):

- identified − duplicates − removed = screened
- screened = excluded + sought (+ offene Datensätze, als Warnung „Screening unvollständig“)
- sought = not retrieved + assessed
- assessed = excluded (Summe aller Gründe) + included (+ offene)

## 6. Nicht-funktionale Anforderungen

- **Performance:** 10.000 Datensätze pro Projekt ohne spürbare Verzögerung beim Screening (Virtualisierung von Listen, Deduplizierung im Web Worker).
- **Datenschutz:** Kein Datenversand außer an OpenAlex bei aktiver Suche. Die Datenschutzerklärung ist entsprechend kurz.
  - **Content Security Policy (spätestens Meilenstein 7):** Das Versprechen „kein Datenversand außer an OpenAlex“ wird technisch erzwungen, nicht nur zugesagt. Weil GitHub Pages keine eigenen HTTP-Header erlaubt, wird die CSP als `<meta http-equiv="Content-Security-Policy">` in `index.html` gesetzt, mindestens mit `default-src 'self'` und `connect-src 'self' https://api.openalex.org`; Schriften, Skripte, Styles und Bilder nur aus `'self'` (bzw. `data:`/`blob:`, wo für Exporte nötig). Ein E2E-Test prüft, dass die Policy greift. Die CSP ist auch ein Argument gegenüber Hochschulen und Datenschutzbeauftragten.
  - **Hosting-Hinweis für die Datenschutzerklärung:** Die App wird über GitHub Pages (GitHub Inc., USA) unter facetreview.org ausgeliefert. Beim Seitenaufruf verarbeitet GitHub technisch notwendige Verbindungsdaten, insbesondere die IP-Adresse. Das ist kein Tracking durch die App, muss aber in der Datenschutzerklärung benannt werden (inkl. Verweis auf die GitHub-Datenschutzbestimmungen).
- **Barrierefreiheit:** WCAG 2.1 AA, vollständige Tastaturbedienung, sichtbarer Fokus, Kontraste ≥ 4.5:1.
- **Browser:** Aktuelle Versionen von Chrome, Edge, Firefox und Safari.
- **Offline:** Als PWA installierbar (Meilenstein 7). Ohne Netz funktioniert alles außer der OpenAlex-Suche.
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
