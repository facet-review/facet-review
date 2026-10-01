# Golden Scenario für das Flow-Diagramm (Meilenstein 5)

Ein vollständig durchgespieltes Projekt mit **bekannten Soll-Zahlen für jede Box** des PRISMA-2020-Flow-Diagramms. Grundlage sind die synthetischen Fixtures aus `tests/fixtures/synthetic/`. `computeFlow()` muss exakt diese Zahlen liefern.

Variante: **neuer Review, nur Datenbanken und Register** (`new_db`).

## 1. Projekt-Setup

| Quelle (Typ `database`) | Datei | Importierte Datensätze |
|---|---|---|
| Synthetic Scopus | `synthetic/edge-cases.ris` | 12 |
| Synthetic PubMed | `synthetic/edge-cases.nbib` | 2 |
| Synthetic CSV-DB | `synthetic/edge-cases.csv` | 2 |

Ausschlussgründe im Projekt (in dieser Reihenfolge): `Falsche Population`, `Falsches Studiendesign`, `Falsche Sprache`.

## 2. Deduplizierung

| Gruppe | Mitglieder | Regel | Aktion |
|---|---|---|---|
| A | A1 (primär), A2 | doi | automatisch |
| B | B-ris (primär), B-nbib | doi | automatisch |
| K | K1 (primär), K2 | pmid | automatisch |
| C | C1 (primär), C2 | title-fuzzy | **bestätigt** |
| D1 / D2 | – | title-fuzzy | **abgelehnt**, bleiben getrennt |

→ 4 Dubletten entfernt, **12 eindeutige Screening-Einheiten**: A, B, K, C, D1, D2, E1, F1, F2, G1, H1, L1.

## 3. Screening Stufe 1 (Titel/Abstract)

| Entscheidung | Einheiten | Anzahl |
|---|---|---|
| include | A, B, K, C, D1, D2, E1 | 7 |
| exclude | F1, F2, G1, H1, L1 | 5 |

Zusätzlicher Prüffall: Bei **H1** zuerst `include`, dann mit `Z` rückgängig machen und `exclude` setzen. Zählen darf nur die letzte Entscheidung; der Audit-Trail enthält beide.

## 4. Screening Stufe 2 (Volltext)

| Einheit | Entscheidung | Grund |
|---|---|---|
| E1 | not_retrieved | – |
| A | exclude | Falsches Studiendesign |
| D1 | exclude | Falsches Studiendesign |
| C | exclude | Falsche Sprache |
| B | include | – |
| K | include | – |
| D2 | include | – |

**Report → Studie:** B und K werden **derselben Studie** „Studie 1“ zugeordnet, D2 bildet „Studie 2“.

## 5. Soll-Zahlen im Flow-Diagramm

| Box (PRISMA 2020) | Soll |
|---|---|
| Records identified from: Databases | **16** (pro Datenbank: Synthetic Scopus 12, Synthetic PubMed 2, Synthetic CSV-DB 2) |
| Records identified from: Registers | **0** |
| Duplicate records removed | **4** |
| Records marked as ineligible by automation tools | **0** |
| Records removed for other reasons | **0** |
| Records screened | **12** |
| Records excluded | **5** |
| Reports sought for retrieval | **7** |
| Reports not retrieved | **1** |
| Reports assessed for eligibility | **6** |
| Reports excluded | **3**: Falsches Studiendesign 2, Falsche Sprache 1 (Falsche Population 0 → nicht anzeigen) |
| Studies included in review | **2** |
| Reports of included studies | **3** |

**Konsistenzprüfungen** (alle müssen ohne Warnung durchlaufen):
16 − 4 − 0 − 0 = 12 · 12 = 5 + 7 · 7 = 1 + 6 · 6 = 3 + 3

## 6. Negativ-Fälle (Warnungen müssen erscheinen)

| Abwandlung | Erwartete Warnung |
|---|---|
| Bei D2 die Stufe-2-Entscheidung weglassen | „Screening unvollständig“; assessed 6 ≠ excluded 3 + included 2 (+1 offen) |
| C-Zusammenführung nachträglich aufheben | Duplicates 3, screened 13; C2 erbt die Stufe-1-Entscheidung von C mit Hinweis „nach Aufteilung prüfen“ ¹ |

## 7. Beschriftungen DE / EN

Die englischen Texte folgen der Vorlage (Page et al. 2021, CC BY 4.0). Die deutschen Texte sind eine **Arbeitsübersetzung** und in der App als solche zu kennzeichnen.

| EN (Original) | DE (Arbeitsübersetzung) |
|---|---|
| Identification of studies via databases and registers | Identifikation von Studien über Datenbanken und Register |
| Identification of studies via other methods | Identifikation von Studien über andere Methoden |
| Identification / Screening / Included | Identifikation / Screening / Eingeschlossen |
| Records identified from: Databases / Registers | Identifizierte Datensätze aus: Datenbanken / Registern |
| Records identified from: Websites / Organisations / Citation searching | Identifizierte Datensätze aus: Websites / Organisationen / Zitationssuche |
| Records removed before screening | Vor dem Screening entfernte Datensätze |
| Duplicate records removed | Entfernte Dubletten |
| Records marked as ineligible by automation tools | Durch Automatisierungstools als ungeeignet markiert |
| Records removed for other reasons | Aus anderen Gründen entfernt |
| Records screened | Gescreente Datensätze |
| Records excluded | Ausgeschlossene Datensätze |
| Reports sought for retrieval | Zur Beschaffung angeforderte Berichte |
| Reports not retrieved | Nicht beschaffte Berichte |
| Reports assessed for eligibility | Auf Eignung geprüfte Berichte |
| Reports excluded: Reason 1 … | Ausgeschlossene Berichte: Grund 1 … |
| Studies included in review | In den Review eingeschlossene Studien |
| Reports of included studies | Berichte der eingeschlossenen Studien |
| Previous studies / Studies included in previous version of review | Frühere Studien / In der vorherigen Version eingeschlossene Studien |
| Reports of studies included in previous version of review | Berichte der in der vorherigen Version eingeschlossenen Studien |
| New studies included in review / Reports of new included studies | Neu eingeschlossene Studien / Berichte der neu eingeschlossenen Studien |
| Total studies included in review / Reports of total included studies | Insgesamt eingeschlossene Studien / Berichte aller eingeschlossenen Studien |

¹ Präzisiert nach der Screening-Regel 3 aus Meilenstein 4 (PRD §4, Entscheidung vom 01.10.2026): Der angezeigte Teil (C1) behält die Entscheidung. Der abgespaltene Teil C2 ist **offen**, die frühere Entscheidung wird ihm als **Vorschlag** angezeigt („nach Aufteilung prüfen“, Übernahme per Klick bzw. Taste). Er zählt damit nicht als „sought“, sondern als offen: sought bleibt 7, und die Konsistenzprüfung meldet „Screening unvollständig (1 offen)“. Hinweis: Primärdatensatz einer Gruppe ist nach der Regel aus Meilenstein 3 der vollständigste Datensatz (bei Gruppe B daher B-nbib mit PMID); die Zahlen ändert das nicht.
