# Barrierefreiheits-Audit (WCAG 2.1 AA) – Meilenstein 7

**Stand:** 01.10.2026 · **Gegenstand:** alle Module und Seiten von Facet Review (Produktionsbuild, Chromium) · **Maßstab:** WCAG 2.1, Stufe A und AA

## Vorgehen

| Prüfung | Werkzeug | Umfang |
|---|---|---|
| Automatische Regeln (axe-core, Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) | `tests/e2e/a11y.spec.ts` | Jede Route mit Daten, **hell und dunkel**: Startseite, Neues Projekt, Impressum, Datenschutz, 404, Projekt, Suche (Übersicht, Quelle, Suchlauf neu/bearbeiten, OpenAlex), Import (Übersicht, Assistent, Dubletten), Screening (beide Stufen, Einzelansicht beider Stufen), Flow-Diagramm (mit Drill-down), Checkliste, Exporte; dazu Zustände nach Interaktion (Feldfehler, Fehlerzusammenfassung, Bestätigungsdialog) |
| Umbruch bei 320 px (1.4.10) | `a11y.spec.ts` | Jede Route: kein horizontales Scrollen der Seite (Tabellen dürfen in ihrem eigenen Bereich scrollen) |
| Textabstände (1.4.12) | `a11y.spec.ts` | Jede Route bei 320 px mit Zeilenhöhe 1,5, Zeichenabstand 0,12 em, Wortabstand 0,16 em, Absatzabstand 2 em |
| Tastatur (2.1.1, 2.1.2, 2.4.3, 2.4.7) | `a11y.spec.ts` | Jede Route: Tab bis zum Seitenende, jeder Halt mit sichtbarem Fokus (≥ 2 px Rahmen), keine Falle oder Schleife |
| Bedienabläufe per Tastatur | bestehende E2E-Tests | Screening mit Einzeltasten und Buttons, Ausschlussgrund per Ziffer, Drill-down im Flow-Diagramm per Enter, Checkliste mit Bestätigungsdialog, Sortieren von Listen |
| Manuelle Durchsicht | Tastatur, Zoom, Code-Review | siehe unten |

## Befunde und Behebung

| Kriterium | Befund | Behebung |
|---|---|---|
| 1.4.10 Umbruch | Einspaltige Grid-Container wuchsen mit breitem Inhalt (Tabellen, Dateiauswahl) und verbreiterten die ganze Seite (Projekt, Import-Assistent, Screening-Liste). | Alle einspaltigen Grids nutzen `minmax(0, 1fr)`; Eingabefelder sind auf ihren Container begrenzt (`max-width: 100%`). |
| 1.4.10 Umbruch | Visuell versteckter Text (absolut positioniert) in horizontal scrollenden Tabellen trat aus dem Scrollbereich aus und verbreiterte die Seite (Suche). | Scroll-Container sind positioniert (`position: relative`). |
| 1.4.12 Textabstände | Die Umschalter „Sprache“/„Darstellung“ im Kopfbereich brachen bei 320 px nicht um. | `ToggleGroup` bricht um (Gruppe unter die Beschriftung). |
| 2.4.7 Fokus sichtbar | Datumsfelder zeigten keinen Fokusrahmen, solange der Fokus auf Tag, Monat, Jahr oder dem Kalender-Button lag (Chromium). | Fokusrahmen per `:focus-within` für `input[type='date']`. |

Die automatischen axe-Prüfungen meldeten auf keiner Route Verstöße (hell und dunkel).

## Manuelle Prüfpunkte

| Kriterium | Ergebnis |
|---|---|
| 2.4.1 Blöcke überspringen | „Zum Inhalt springen“ ist der erste Tab-Halt. |
| 2.4.3 Fokusreihenfolge | Folgt der Dokumentreihenfolge; nach Seitenwechsel liegt der Fokus auf dem Inhalt, nach Dialogen auf dem auslösenden Element, im Screening auf dem Titel des nächsten Datensatzes. |
| 2.1.4 Tastaturkürzel | Einzeltasten-Kürzel im Screening sind abschaltbar, wirken nie in Eingabefeldern; jede Aktion gibt es auch als Button. |
| 3.3.1/3.3.3 Fehler | Fehlerzusammenfassung mit Sprunglinks und Fokus, Fehlertext am Feld, `aria-invalid`. |
| 4.1.3 Statusmeldungen | Speichern, Importe, Exporte, OpenAlex-Fortschritt und Update-Hinweis über `role="status"`; Fehler über `role="alert"`. |
| 3.1.2 Sprache von Teilen | Englische Originaltexte (Checkliste, Quellenangaben) mit `lang="en"`; Seitensprache folgt der Oberflächensprache. |
| 1.4.3/1.4.11 Kontrast | Durch axe auf allen Routen in beiden Darstellungen geprüft; Bedienelemente mit kräftigeren Linien (`--color-line-strong`). |
| 1.4.4 Zoom 200 % | Durch den Umbruchtest bei 320 px abgedeckt (entspricht 400 % bei 1280 px). |
| 2.3.3 / Bewegung | `prefers-reduced-motion` schaltet Übergänge ab. |
| 1.1.1 Nicht-Text-Inhalt | Logo ist dekorativ (`aria-hidden`), das Flow-Diagramm hat eine gleichwertige Tabelle als Textalternative. |

## Bekannte Grenzen

- **PDF-Exporte sind nicht getaggt** (Einschränkung der PDF-Bibliothek, siehe PRD, Exporte). Gleichwertige barrierefreie Alternativen: die Checkliste in der App, der Suchanhang als Markdown und alle CSV-Exporte.
- Geprüft wurde automatisiert in Chromium. Eine Prüfung mit Screenreadern (NVDA, VoiceOver) und in Firefox/Safari durch Menschen steht vor Version 1.0 noch aus.
