# CLAUDE.md – Facet Review

> Projektregeln für Claude Code. Vor jeder Arbeit lesen. Produktdetails stehen in `docs/PRD.md`.

## Was ist Facet Review?

**Facet Review** – *Jede Facette Ihrer Suche. Nachvollziehbar.* / *Every facet of your search. Traceable.*
Untertitel: *Systematic Reviews nach PRISMA 2020 & PRISMA-S*

Eine browserbasierte Web-App, die Einzelpersonen (v. a. Studierende und Forschende) durch die Literatursuche, das Screening und das Reporting eines Systematic Reviews führt. Das Alleinstellungsmerkmal ist die **lückenlose Kette**:

```
Suche (PRISMA-S) → importierte Treffer → Deduplizierung → Screening-Entscheidung → Zahl → Flow-Diagramm (PRISMA 2020) → Checkliste
```

Jede Zahl im Flow-Diagramm muss auf konkrete Datensätze zurückführbar sein. Es gibt keine manuell eingetippten Zahlen, wo das Tool sie aus Daten ableiten kann.

## Nicht verhandelbare Prinzipien

1. **Local-first, kein Backend.** Alle Daten bleiben im Browser (IndexedDB). Es gibt keinen Server, keine Accounts, keine Datenübertragung an Dritte, außer an die OpenAlex-API, wenn die Nutzerin dort aktiv sucht.
2. **Offene Formate.** Import: RIS, BibTeX, PubMed/MEDLINE (.nbib), CSV. Intern: CSL-JSON für bibliografische Daten. Export: JSON (Projekt), RIS, CSV, SVG/PNG, PDF.
3. **Kein Tracking.** Keine Analytics, keine Cookies, keine externen CDNs. Schriften werden lokal gebündelt.
4. **Nachvollziehbarkeit vor Automatik.** Deduplizierung und alle Zählungen sind transparent, erklärbar und manuell korrigierbar. Keine Blackbox.
5. **Zweisprachig ab Tag 1.** Deutsch ist die Standardsprache, Englisch umschaltbar. **Keine hartcodierten UI-Strings.**
6. **Barrierefreiheit nach WCAG 2.1 AA.** Das Screening ist vollständig per Tastatur bedienbar.
7. **Kein Google-Scholar-Scraping.** Google-Scholar-Ergebnisse werden nur als Datei importiert (z. B. aus GSscraper oder Publish or Perish) und als Suchmaschinenquelle nach PRISMA-S dokumentiert.
8. **Datenmodell ist teamfähig, UI nicht.** Version 1 ist für Einzelpersonen gebaut, aber jede Entscheidung trägt eine `reviewerId`, damit Teams später ohne Datenmigration möglich sind.

## Stack

| Bereich | Wahl |
|---|---|
| Sprache | TypeScript (strict) |
| UI | React 18+ mit Vite |
| Routing | React Router |
| State | Zustand (UI-State), Dexie.js und `dexie-react-hooks` (persistente Daten) |
| Persistenz | IndexedDB über Dexie.js |
| Bibliografie-Parsing | citation-js (RIS, BibTeX, CSL-JSON), eigener Parser für .nbib, Papa Parse für CSV |
| i18n | react-i18next, Sprachdateien in `src/i18n/{de,en}.json` |
| Flow-Diagramm | Eigenes SVG-Rendering (React-Komponente), kein Diagramm-Framework |
| PDF-Export | pdf-lib oder @react-pdf/renderer (Entscheidung in Meilenstein 6, kurz begründen) |
| Styling | **CSS Modules** mit Design-Tokens als CSS Custom Properties in `src/design/tokens.css` (M0: Tokens nativ, globale scharfe Ecken/Haarlinien ohne Utility-Defaults, lesbare semantische Klassen, a11y-Werte zentral, keine Zusatzabhängigkeit) |
| Paketmanager | **npm** mit `package-lock.json`, in CI `npm ci` (M0: vorinstalliert, niedrigste Hürde für Beitragende; pnpm-Vorteile greifen bei einer Single-Package-App kaum) |
| Tests | Vitest (Unit), Playwright (E2E) |
| PWA | vite-plugin-pwa (Meilenstein 7) |
| Lint/Format | ESLint 9 (Flat Config; `jsx-a11y` strict, `i18next/no-literal-string` gegen hartcodierte UI-Strings) und Prettier |
| Lizenz | AGPL-3.0 |

## Verzeichnisstruktur (Ziel)

```
src/
  app/            # Routing, Layout, Provider
  features/
    project/      # Modul 1: Projekt & Kriterien
    search/       # Modul 2: Suchdokumentation (PRISMA-S)
    import/       # Modul 3: Import & Deduplizierung
    screening/    # Modul 4: Screening
    flow/         # Modul 5: Flow-Diagramm
    checklist/    # Modul 6: PRISMA-2020-Checkliste
    export/       # Exporte
  domain/         # Reine TS-Logik ohne React: Typen, Zählung, Dedup, Parser
  db/             # Dexie-Schema, Migrationen
  i18n/
  design/         # Tokens, Basis-Komponenten
docs/
  PRD.md
  reference/      # PRISMA-Vorlagen (CC BY 4.0) und Checkliste als JSON
tests/e2e/
```

**Regel:** Die gesamte Fachlogik (Zählung, Deduplizierung, Parser, Export-Mapping) liegt in `src/domain/` als reine, getestete Funktionen. React-Komponenten rechnen nichts selbst.

## Konventionen

- Code, Bezeichner und Commits auf **Englisch**. UI-Texte ausschließlich über i18n-Keys. Dokumentation in `docs/` auf **Deutsch**.
- Commits im Format Conventional Commits (`feat:`, `fix:`, `docs:` …).
- Jede Funktion in `src/domain/` bekommt Unit-Tests. **Zählung und Deduplizierung sind die kritischsten Stellen, Testabdeckung dort ≥ 90 %.**
- IDs sind UUIDs (`crypto.randomUUID()`).
- Zeitstempel sind ISO 8601.
- Das Projekt-JSON enthält `schemaVersion`. Jede Schemaänderung bekommt eine Migrationsfunktion und einen Test.
- Keine neuen Abhängigkeiten ohne kurze Begründung im PR bzw. in der Commit-Beschreibung.

## Design

- Eigene Produktmarke mit der DNA des Autors: **IBM Plex Sans** (UI), **Source Serif 4** (Überschriften-Akzente), **scharfe Ecken** (border-radius 0), **Haarlinien** (1px).
- Palette: Steingrau als Basis (`#DDE1E2`), Akzent tiefes Petrol (`#1F5F6B`, vorläufig), neutrale Grautöne. Dark Mode über Tokens.
- Die Arbeitsflächen (v. a. das Screening) sind ruhig und zurückhaltend. Die Prisma- und Facetten-Metapher lebt im Logo und auf der Startseite, nicht in jedem Bedienelement.
- Fußzeile: „Ein Projekt von Günther Hochhauser“ mit Link auf ghochhauser.at.

## Rechtliches und Attribution

- PRISMA-2020-Checkliste und Flow-Diagramm-Vorlage stehen unter CC BY 4.0. Die Quellenangabe muss **sichtbar in der App und in jedem Export** stehen:
  - Page MJ, et al. *The PRISMA 2020 statement.* BMJ 2021;372:n71. doi:10.1136/bmj.n71
  - Rethlefsen ML, et al. *PRISMA-S.* Syst Rev 2021;10:39. doi:10.1186/s13643-020-01542-z
- „PRISMA“ steht nie im Produktnamen, nur im Untertitel bzw. beschreibend.
- `CONTRIBUTING.md` hält fest, dass Beiträge unter AGPL-3.0 stehen und der Autor sich eine Doppellizenzierung vorbehält. Ab dem ersten externen Beitrag wird ein CLA eingeführt.

## Arbeitsweise mit Claude Code

- Größere Schritte zuerst im **Plan Mode** planen und den Plan zur Freigabe vorlegen.
- Meilenstein für Meilenstein arbeiten (siehe `docs/PRD.md`, Abschnitt Roadmap). Nach jedem Meilenstein gilt: Tests grün, kurze Zusammenfassung, dann Freigabe abwarten.
- Bei fachlichen Unklarheiten zu PRISMA oder PRISMA-S **nachfragen statt raten**. Die Referenzdateien liegen in `docs/reference/`.

## Datenmodell und Persistenz (ab Meilenstein 1)

- Typen: `src/domain/types.ts`. Jede Entität trägt `projectId`. Nebenwirkungen (`newId`, `now`) werden in Domain-Funktionen hineingereicht (`src/app/runtime.ts`), damit Tests deterministisch sind.
- Austauschformat: `src/domain/exchange/` (`format: 'facet-review-project'`, `schemaVersion`). **Jede Formatänderung:** `CURRENT_SCHEMA_VERSION` erhöhen, Eintrag in `PROJECT_MIGRATIONS` mit Test, PRD Abschnitt 4 nachtragen.
- Datenbank: `src/db/db.ts` (Dexie). **Jede Schemaänderung:** neue `this.version(n)` mit Upgrade-Funktion, nie eine bestehende Version ändern.
- Zugriff nur über Repository-Funktionen in `src/db/` (atomare Transaktionen, Löschen kaskadierend). Komponenten lesen reaktiv mit `useLiveQuery`.
- Coverage-Schwelle 90 % für `src/domain/**`, erzwungen in CI (`npm run test:coverage`).

## Befehle

Node 22 (`.nvmrc`). Paketmanager: npm.

```
npm run dev            # Entwicklungsserver (Vite)
npm run build          # Typecheck + Produktionsbuild (statisch, dist/)
npm run preview        # Produktionsbuild lokal ausliefern
npm run typecheck      # tsc -b
npm run test           # Vitest (einmalig)
npm run test:watch     # Vitest im Watch-Modus
npm run test:coverage  # Vitest mit Coverage (v8)
npm run test:e2e       # Playwright (baut und startet vite preview selbst)
npm run lint           # ESLint + Prettier-Check
npm run format         # Prettier schreibt
```

Playwright braucht einmalig `npx playwright install chromium`. In Umgebungen mit vorinstalliertem Chromium stattdessen `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/pfad/zu/chrome npm run test:e2e`.

Versionsgrenzen: TypeScript bleibt auf 6.0.x (typescript-eslint unterstützt < 6.1), ESLint auf 9 (eslint-plugin-jsx-a11y unterstützt ESLint 10 noch nicht).

## Deployment

- Hosting: **GitHub Pages** mit eigener Domain **facetreview.org** (`www` leitet auf die Hauptdomain um). Die Domain ist in Settings → Pages eingetragen; eine `CNAME`-Datei gibt es bewusst nicht, weil GitHub sie beim Deploy per Actions ignoriert.
- Workflow `.github/workflows/deploy.yml`: Bei jedem Push auf `main` läuft zuerst die komplette CI (`ci.yml` als wiederverwendbarer Workflow), danach Build und Veröffentlichung. Rot in der CI heißt: kein Deploy.
- Routing mit sauberen URLs (BrowserRouter). Der SPA-Fallback ist `dist/404.html` als Kopie von `index.html` (Vite-Plugin in `vite.config.ts`). Deep Links funktionieren, der Server antwortet dabei mit HTTP 404 – für eine local-first App ohne teilbare Inhalte unerheblich.
- `base` bleibt `/` (absolute Asset-Pfade), sonst bricht der Fallback unter verschachtelten Pfaden.

