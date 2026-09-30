# Mitarbeit an Facet Review

Danke für Ihr Interesse! Beiträge – Fehlermeldungen, Übersetzungen, Code, Rückmeldungen aus der Praxis von Reviews und Bibliotheken – sind willkommen. Fragen und Issues dürfen auch auf Englisch gestellt werden.

## Lizenz der Beiträge

- Facet Review steht unter der **GNU AGPL-3.0**. Mit dem Einreichen eines Beitrags erklären Sie sich einverstanden, dass er unter derselben Lizenz veröffentlicht wird.
- Der Autor (Günther Hochhauser) **behält sich vor, Facet Review zusätzlich unter anderen Lizenzbedingungen anzubieten (Doppellizenzierung).**
- Damit das rechtlich möglich ist, wird **ab dem ersten externen Code-Beitrag ein Contributor License Agreement (CLA)** eingeführt. Bis dahin bitte vor größeren Beiträgen ein Issue eröffnen, damit wir das vorab klären können.

## Grundsätze

Die verbindlichen Projektregeln stehen in [`CLAUDE.md`](CLAUDE.md), das Produkt ist in [`docs/PRD.md`](docs/PRD.md) beschrieben. Besonders wichtig:

- **Local-first, kein Backend, kein Tracking, keine externen CDNs.**
- **Keine hartcodierten UI-Texte:** alle Texte über i18n-Schlüssel in `src/i18n/de.json` und `src/i18n/en.json` (beide Dateien müssen dieselben Schlüssel haben – ein Test prüft das).
- **Fachlogik** (Zählung, Deduplizierung, Parser, Export-Mapping) gehört als reine, getestete Funktionen nach `src/domain/`. React-Komponenten rechnen nichts selbst.
- **Barrierefreiheit** nach WCAG 2.1 AA; ESLint (`jsx-a11y`) und axe-Tests in Playwright helfen dabei.
- **Design:** nur Design-Tokens aus `src/design/tokens.css` verwenden, keine Rohwerte für Farben, Abstände oder Linien.

## Konventionen

- Code, Bezeichner und Commit-Nachrichten auf **Englisch**; Dokumentation in `docs/` auf **Deutsch**.
- Commits im Format [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:` …).
- Neue Abhängigkeiten nur mit kurzer Begründung im Pull Request.
- Jede Funktion in `src/domain/` bekommt Unit-Tests; für Zählung und Deduplizierung gilt eine Testabdeckung von mindestens 90 %.

## Ablauf

1. Issue eröffnen oder an einem bestehenden anknüpfen.
2. Branch anlegen, Änderung umsetzen.
3. Lokal prüfen: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`.
4. Pull Request mit Beschreibung des Was und Warum eröffnen. Die CI führt dieselben Prüfungen aus.
