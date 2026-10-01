# Facet Review

**Jede Facette Ihrer Suche. Nachvollziehbar.**
Systematic Reviews nach PRISMA 2020 & PRISMA-S

Facet Review ist eine browserbasierte Web-App, die Einzelpersonen – vor allem Studierende und Forschende – durch Literatursuche, Screening und Reporting eines Systematic Reviews führt. Im Mittelpunkt steht eine lückenlose Kette:

```
Suche (PRISMA-S) → Treffer → Deduplizierung → Screening-Entscheidung → Zahl → Flow-Diagramm (PRISMA 2020) → Checkliste
```

Jede Zahl im Flow-Diagramm ist auf konkrete Datensätze zurückführbar.

> **Status:** Meilenstein 7 abgeschlossen, Version 1.0 in Vorbereitung. Alle Module sind nutzbar.

## Prinzipien

- **Local-first:** Alle Daten bleiben im Browser (IndexedDB). Kein Server, keine Accounts.
- **Kein Tracking:** keine Analytics, keine Cookies, keine externen CDNs.
- **Offene Formate:** RIS, BibTeX, PubMed/MEDLINE, CSV, CSL-JSON.
- **Nachvollziehbarkeit vor Automatik:** Deduplizierung und Zählungen sind transparent und korrigierbar.
- **Zweisprachig** (Deutsch/Englisch) und **barrierefrei** nach WCAG 2.1 AA (Audit: [`docs/a11y-audit.md`](docs/a11y-audit.md)).
- **Technisch abgesichert:** Eine Content Security Policy erlaubt Verbindungen nur zur App selbst und – bei aktiver Suche – zur OpenAlex-API.
- **Offline nutzbar:** Als Web-App (PWA) installierbar; nach dem ersten Besuch funktioniert alles ohne Netz außer der OpenAlex-Suche.

## Entwicklung

Voraussetzung: Node.js 22 (siehe `.nvmrc`).

```bash
npm install
npm run dev        # Entwicklungsserver
npm run build      # Produktionsbuild (statisch, in dist/)
npm run test       # Unit-Tests (Vitest)
npm run test:e2e   # End-to-End-Tests (Playwright)
npm run lint       # ESLint und Prettier
```

Vor dem ersten `npm run test:e2e` einmalig `npx playwright install chromium` ausführen.

Hilfsskripte: `node scripts/record-openalex.mjs` nimmt echte OpenAlex-Antworten für die Tests auf (siehe `tests/fixtures/openalex/README.md`), `node scripts/generate-icons.mjs` erzeugt die App-Icons aus dem Logo.

## Veröffentlichung

Facet Review läuft unter **[facetreview.org](https://facetreview.org)** auf GitHub Pages. Jeder Push auf `main` wird nach erfolgreicher CI automatisch gebaut und veröffentlicht (`.github/workflows/deploy.yml`).

Produktbeschreibung: [`docs/PRD.md`](docs/PRD.md) · Mitarbeit: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Lizenz und Attribution

Facet Review ist freie Software unter der [GNU Affero General Public License v3.0](LICENSE).
© Günther Hochhauser – [ghochhauser.at](https://ghochhauser.at)

Die PRISMA-2020-Checkliste und die Flow-Diagramm-Vorlage stehen unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):

- Page MJ, et al. _The PRISMA 2020 statement._ BMJ 2021;372:n71. [doi:10.1136/bmj.n71](https://doi.org/10.1136/bmj.n71)
- Rethlefsen ML, et al. _PRISMA-S._ Syst Rev 2021;10:39. [doi:10.1186/s13643-020-01542-z](https://doi.org/10.1186/s13643-020-01542-z)

Facet Review ist kein offizielles Werkzeug der PRISMA-Gruppe.

---

## English

**Every facet of your search. Traceable.**
Systematic reviews according to PRISMA 2020 & PRISMA-S

Facet Review is a browser-based, local-first web app that guides individual researchers and students through searching, screening and reporting a systematic review. Every number in the PRISMA 2020 flow diagram is derived from – and traceable to – concrete records, from the documented search (PRISMA-S) through deduplication and screening decisions to the checklist. All data stays in your browser; there is no backend, no account and no tracking. The interface is available in German (default) and English and targets WCAG 2.1 AA.

Status: milestone 7 complete, version 1.0 in preparation; published at [facetreview.org](https://facetreview.org). Installable as a progressive web app and usable offline except for the OpenAlex search; a Content Security Policy only allows connections to the app itself and the OpenAlex API. See the development commands above; licensed under AGPL-3.0. Contributions are welcome – see [`CONTRIBUTING.md`](CONTRIBUTING.md) (German; questions in English are fine).
