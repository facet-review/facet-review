# Startprompt für die erste Claude-Code-Sitzung

> **Vorbereitung:**
> 1. Leeres Repository `facet-review` anlegen (GitHub-Organisation `facet-review`).
> 2. `CLAUDE.md` in das Hauptverzeichnis legen, `docs/` samt `docs/reference/` übernehmen.
> 3. Claude Code im Repository starten und den folgenden Prompt einfügen.

---

```
Lies zuerst CLAUDE.md und docs/PRD.md vollständig, danach die Dateien in docs/reference/.

Wir bauen Facet Review, eine local-first Web-App für Systematic Reviews nach PRISMA 2020 und PRISMA-S. Wir arbeiten Meilenstein für Meilenstein nach der Roadmap in docs/PRD.md, Abschnitt 7.

Aufgabe dieser Sitzung: Meilenstein 0 (Setup).

Vorgehen:
1. Wechsle in den Plan Mode. Fasse in 5–8 Sätzen zusammen, wie du das Produkt verstanden hast, damit ich Missverständnisse früh korrigieren kann.
2. Triff und begründe kurz die zwei offenen Setup-Entscheidungen aus CLAUDE.md:
   - Styling: CSS Modules oder Tailwind (Kriterien: Design-Tokens, scharfe Ecken und Haarlinien, Wartbarkeit, Barrierefreiheit)
   - Paketmanager: npm oder pnpm
3. Lege einen Plan für Meilenstein 0 vor. Er umfasst:
   - Vite + React + TypeScript (strict), ESLint, Prettier
   - Vitest und Playwright mit je einem Beispieltest
   - react-i18next mit de.json (Standard) und en.json sowie einem Sprachumschalter
   - Design-Tokens als CSS Custom Properties (Farben, Typografie, Abstände, Linien), Light und Dark Mode
   - Lokal gebündelte Schriften IBM Plex Sans und Source Serif 4 (kein CDN)
   - App-Layout: Kopfzeile mit Wortmarke „Facet Review“, Navigation für die sechs Module (zunächst als Platzhalter-Seiten), Fußzeile mit „Ein Projekt von Günther Hochhauser“ und PRISMA-Attribution
   - LICENSE (AGPL-3.0), README.md (DE, kurz; EN-Abschnitt), CONTRIBUTING.md (inkl. Hinweis auf Doppellizenzierung)
   - npm-Skripte: dev, build, test, test:e2e, lint; im Abschnitt „Befehle“ der CLAUDE.md nachtragen
   - GitHub-Actions-Workflow: Lint, Test und Build bei jedem Push
4. Warte auf meine Freigabe, bevor du Code schreibst.
5. Nach der Umsetzung: Tests ausführen, Build prüfen, eine kurze Zusammenfassung geben (was gebaut wurde, was offen ist) und einen Commit im Format Conventional Commits vorschlagen.

Wichtig: Keine Fachlogik in dieser Sitzung. Kein Backend, kein Tracking, keine externen CDNs. Frag nach, wenn etwas im PRD unklar oder widersprüchlich ist.
```

---

## Prompts für die folgenden Meilensteine (Vorlage)

```
Lies CLAUDE.md und docs/PRD.md. Aufgabe: Meilenstein <N> (<Name>).
Plan Mode: Plan vorlegen, inkl. der Dateien in src/domain/ und der Tests, die du schreiben wirst.
Nach Freigabe umsetzen; Tests zuerst für die Fachlogik (Zählung, Dedup, Parser).
Am Ende: Tests grün, Build ok, Zusammenfassung, Commit-Vorschlag.
```

**Tipp:** Für Meilenstein 3 (Import) echte Beispiel-Exporte aus Scopus, PubMed, Web of Science, EBSCO und OpenAlex als Fixtures in `tests/fixtures/` ablegen, jeweils mit 20 bis 50 Datensätzen und ein paar absichtlichen Dubletten. Das ist der beste Qualitätshebel für den Parser.
