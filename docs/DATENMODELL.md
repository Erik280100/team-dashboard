# Datenmodell (PostgreSQL) — Nachbildung der Firestore-Datenbank

Entwurf eines relationalen Modells für das Team-Dashboard. Abgeleitet aus `src/types/*`, `src/lib/calc/format.ts`,
`firestore.rules` und `functions/src`. **Nicht gegen echte Daten oder Finovas bestehendes Schema geprüft.**
Vorhandene Finova-Tabellen (Mitarbeiter, Kunden, Kreditfälle) zuerst abgleichen und dann verknüpfen statt neu anlegen.

- PDF zum Weitergeben: [`Datenmodell_PostgreSQL.pdf`](Datenmodell_PostgreSQL.pdf)
- SQL zum Anlegen: [`schema.postgres.sql`](schema.postgres.sql) (getestet: läuft in PostgreSQL 16 fehlerfrei durch)
- Umfang: 31 Tabellen, 234 Spalten, 29 Fremdschlüssel
- Die Diagramme (Mermaid) sind aus dem laufenden Schema erzeugt, nicht von Hand gezeichnet. Sie rendern in GitHub, VS Code
  (Mermaid-Erweiterung) und auf mermaid.live. Legende: `PK` Primärschlüssel, `FK` Fremdschlüssel; `||--o{` = genau ein Elternteil,
  viele Kinder; `|o--o{` = Elternteil optional.

## Wichtigste Unterschiede zu Firestore
1. **`ancestors` (Array) → `employee_ancestor`**: Firestore prüft Rechte über die gespeicherte Vorgesetztenkette. In SQL ist das eine
   Closure-Tabelle (oder rekursive CTE/`ltree`). Sie muss gepflegt werden, wenn sich `employee.manager_id` ändert
   (heute macht das die Cloud Function `onStructureChange`).
2. **Verschachtelte Objekte → eigene Tabellen**: `ehByPlan`, `careerUnits`, `planRates`, Quartale, Notizen und Verbindungen.
3. **Rechte**: Die Firestore-Regeln (`firestore.rules`) gibt es in PostgreSQL nicht automatisch. Entweder serverseitig in der API
   oder per Row-Level-Security auf `employee_ancestor` aufbauen.
4. **Denormalisierte Werte** (`employee.ist`, `employee_month_stats`, `month_totals`) werden heute serverseitig berechnet; sie können
   Spalten bleiben (mit Job) oder Views werden.
5. **Archiv ohne Fremdschlüssel auf `employee`**: Snapshots sollen auch bestehen bleiben, wenn ein Mitarbeiter später gelöscht wird.

## Zuordnung Firestore → Tabellen
| Firestore | PostgreSQL | Hinweis |
|---|---|---|
| `users/{uid}`, `employees/{id}/private/*` | `app_user` | bei Finova: SSO/bestehende Benutzerverwaltung |
| `employees/{id}` | `employee`, `employee_plan_units`, `employee_vb_abwickler`, `employee_month_stats` | `ehByPlan`/`careerUnits`/`vbByAbwickler`/`monthStats` werden eigene Tabellen |
| `employees/{id}.ancestors` (Array) | `employee_ancestor` | Closure-Tabelle für die Rechteprüfung "Vorgesetzte sehen den Teilbaum" |
| `org/structure` (`tree`, `notes`, `conns`, `planRates`) | `employee` (manager_id, color, status, sort_order), `org_note`, `org_connection`, `plan_rate` | Der Baum ergibt sich aus `manager_id` |
| `org/careerPlans` | `career_plan` |  |
| `org/teamGoal` (`teamGoal`, `history`) | `team_goal`, `team_history` |  |
| `employees/{id}/planWeeks/{YYYY-Www}` | `plan_week` | ein Dokument je Mitarbeiter und Woche |
| `employees/{id}/planMonthNotes/{YYYY-MM}` | `plan_month` |  |
| `employees/{id}/planAnnual/{YYYY}` | `plan_annual`, `plan_quarter` | Quartale waren ein verschachteltes Objekt |
| `employees/{id}/attendance/*` | `attendance` | aktueller Stand je Mitarbeiter |
| `employees/{id}/todos/{id}` | `board_todo` | nur für den Besitzer sichtbar |
| `financings/{caseId}` | `financing_case`, `financing_doc_check` | `ownerId`/`abwicklerId`; `ancestors` entfällt (Closure-Tabelle) |
| `sales/{id}` | `sale` | `ownerId`; nachträglich änderbar: kunde, beginn, policiert, ausbezahlt |
| `celebrations/{id}` | `celebration` | kurzlebig; evtl. Event/WebSocket statt Tabelle |
| `snapshots/{YYYY-MM}` (+ `/employees/{id}`) | `month_snapshot`, `snapshot_*` | unveränderlich nach Monatsabschluss |
| `org/archiveIndex` | `month_totals` | ableitbar, auch als Materialized View möglich |

## Mitarbeiter & Konten

```mermaid
erDiagram
  employee |o--o{ employee : "manager_id"
  employee ||--o{ employee_ancestor : "employee_id"
  employee ||--o{ employee_ancestor : "ancestor_id"
  employee |o--o{ app_user : "employee_id"
  employee ||--o{ employee_plan_units : "employee_id"
  employee ||--o{ employee_vb_abwickler : "employee_id"
  employee ||--o{ employee_vb_abwickler : "abwickler_id"
  employee ||--o{ employee_month_stats : "employee_id"
  employee {
    text id PK
    text name
    text role
    text manager_id FK
    boolean active
    boolean is_new
    date joined_at
    numeric bonus
    numeric soll
    numeric ist
    text color
    text color2
    text status
    integer sort_order
  }
  employee_ancestor {
    text employee_id PK,FK
    text ancestor_id PK,FK
    integer depth
  }
  app_user {
    text uid PK
    text employee_id FK
    text email
    app_role role
    boolean must_change_password
    boolean account_pending
  }
  employee_plan_units {
    text employee_id PK,FK
    plan_id plan PK
    numeric units
    numeric career_units
  }
  employee_vb_abwickler {
    text employee_id PK,FK
    text abwickler_id PK,FK
    numeric units
  }
  employee_month_stats {
    text employee_id PK,FK
    char month PK
    integer at_plan
    integer at_ist
    integer bt_plan
    integer bt_ist
    integer st_plan
    integer st_ist
    integer et_plan
    integer et_ist
    numeric soll
  }
```

## Organisation, Sätze & Teamziel

```mermaid
erDiagram
  employee ||--o{ org_note : "employee_id"
  employee ||--o{ org_connection : "from_id"
  employee ||--o{ org_connection : "to_id"
  org_note {
    bigint id PK
    text employee_id FK
    text text
    text noted_on
  }
  org_connection {
    bigint id PK
    text from_id FK
    text to_id FK
    text label
  }
  plan_rate {
    plan_id plan PK
    text stage PK
    numeric euro_per_unit
  }
  career_plan {
    text id PK
    text title
    text html
    integer sort_order
  }
  team_goal {
    integer id PK
    text note
    integer recruit_goal
    integer recruit_actual
    date period_start
    date period_end
    boolean is_current
  }
  team_history {
    date day PK
    numeric ist
  }
  employee {
    text id PK
  }
```

## Controlling / Planung

```mermaid
erDiagram
  employee ||--o{ plan_week : "employee_id"
  employee ||--o{ plan_month : "employee_id"
  employee ||--o{ plan_annual : "employee_id"
  plan_annual ||--o{ plan_quarter : "employee_id, year"
  employee ||--o| attendance : "employee_id"
  plan_week {
    text employee_id PK,FK
    char week PK
    integer atz
    integer atg
    integer analysen_z
    integer analysen
    integer beratungen_z
    integer beratungen
    integer vertraege
    integer pg
    integer stz
    integer stg
    integer etz
    integer etg
    numeric eh_offen
    numeric eh_gemacht
    integer aktivitaeten_soll
    integer aktivitaeten_ist
    text notes
    boolean submitted
  }
  plan_month {
    text employee_id PK,FK
    char month PK
    text at_note
    text bt_note
    text st_note
    text et_note
    text feedback
    numeric eh_ziel
  }
  plan_annual {
    text employee_id PK,FK
    smallint year PK
    integer vertraege
    integer einheiten
    integer atg
    integer analysen
    integer beratungen
  }
  plan_quarter {
    text employee_id PK,FK
    smallint year PK,FK
    smallint quarter PK
    text milestone
    integer vertraege
    integer einheiten
    integer atg
    integer analysen
    integer beratungen
  }
  attendance {
    text employee_id PK,FK
    boolean seminar
    text seminar_reason
    boolean training
    text training_reason
  }
  employee {
    text id PK
  }
```

## Fachdaten (Board, Finanzierungen, Umsatz)

```mermaid
erDiagram
  employee ||--o{ board_todo : "employee_id"
  employee ||--o{ financing_case : "owner_id"
  employee |o--o{ financing_case : "abwickler_id"
  financing_case ||--o{ financing_doc_check : "case_id"
  employee ||--o{ sale : "owner_id"
  board_todo {
    text id PK
    text employee_id FK
    text title
    text description
    date due_date
    todo_lane lane
    todo_category category
    todo_color color
    boolean flagged
    boolean completed
    boolean archived
    integer sort_order
    timestamptz created_at
  }
  financing_case {
    text id PK
    text owner_id FK
    text abwickler_id FK
    text name
    numeric amount
    financing_kind kind
    employment employment
    boolean aufbereitet
    boolean eingereicht
    boolean kreditvertrag
    boolean archived
    timestamptz created_at
  }
  financing_doc_check {
    text case_id PK,FK
    text item_id PK
    boolean checked
  }
  sale {
    text id PK
    text owner_id FK
    timestamptz booked_at
    text produkt
    numeric praemie
    text praemie_label
    numeric einheiten
    text kunde
    date beginn
    boolean policiert
    boolean ausbezahlt
  }
  celebration {
    bigint id PK
    text name
    bigint at
  }
  employee {
    text id PK
  }
```

## Monatsarchiv

```mermaid
erDiagram
  month_snapshot ||--o{ snapshot_history : "month"
  month_snapshot ||--o{ snapshot_employee : "month"
  snapshot_employee ||--o{ snapshot_employee_units : "month, employee_id"
  month_snapshot ||--o{ snapshot_org_node : "month"
  month_snapshot ||--o{ snapshot_org_note : "month"
  month_snapshot ||--o{ snapshot_org_connection : "month"
  month_snapshot ||--o{ snapshot_plan_rate : "month"
  month_snapshot ||--o| month_totals : "month"
  month_snapshot {
    char month PK
    smallint version
    timestamptz closed_at
    text closed_by
    text goal_note
    integer recruit_goal
    integer recruit_actual
    date period_start
    date period_end
  }
  snapshot_history {
    char month PK,FK
    date day PK
    numeric ist
  }
  snapshot_employee {
    char month PK,FK
    text employee_id PK
    text name
    text role
    numeric soll
    numeric ist
    numeric bonus
    boolean is_new
    date joined_at
    integer at_plan
    integer at_ist
    integer bt_plan
    integer bt_ist
    integer st_plan
    integer st_ist
    integer et_plan
    integer et_ist
  }
  snapshot_employee_units {
    char month PK,FK
    text employee_id PK,FK
    plan_id plan PK
    numeric units
    numeric career_units
  }
  snapshot_org_node {
    text month PK,FK
    text node_id PK
    text parent_id
    text name
    text role
    text color
    text color2
    text status
    integer sort_order
  }
  snapshot_org_note {
    bigint id PK
    text month FK
    text node_id
    text text
    text noted_on
  }
  snapshot_org_connection {
    bigint id PK
    text month FK
    text from_id
    text to_id
    text label
  }
  snapshot_plan_rate {
    text month PK,FK
    plan_id plan PK
    text stage PK
    numeric euro_per_unit
  }
  month_totals {
    char month PK,FK
    text label
    numeric soll
    numeric ist
    integer pct
    integer at_plan
    integer at_ist
    integer bt_plan
    integer bt_ist
    integer et_plan
    integer et_ist
    numeric eh_insurance
    numeric eh_investment
    numeric eh_investment_vb
    numeric eh_credit
    numeric eh_realestate
    numeric total_eur
    integer employee_count
    integer new_hire_count
    integer recruit_goal
    integer recruit_actual
  }
```

## Offene Punkte
- **Einheiten-Historie:** Firestore hält `ehByPlan` nur für den laufenden Monat; frühere Stände stehen im Archiv. Wenn Finova laufend
  auswerten will, wäre eine Tabelle `unit_booking` (je Buchung) sauberer — `sale` bildet das teilweise schon ab.
- **Schlüsseltypen:** IDs sind in Firestore Strings (z. B. `emp_xyz`). Bei Finova eventuell UUID/Integer — Mapping-Tabelle für die Migration.
- **Rollen:** `employee.role` ist Freitext aus dem Strukturbaum (Karrierestufe), `app_user.role` die Zugriffsrolle. Zusammenhang im
  Code: `src/lib/calc/roles.ts`, `src/lib/calc/struktur.ts`.
