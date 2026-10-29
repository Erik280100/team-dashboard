-- Relationales Datenmodell (PostgreSQL) zur Nachbildung des Team-Dashboards, das heute in Cloud Firestore liegt.
-- Entwurf: aus src/types/*, src/lib/calc/format.ts, firestore.rules und functions/src abgeleitet, NICHT gegen echte Daten
-- oder Finovas Schema geprüft. Vorhandene Finova-Tabellen (Mitarbeiter, Kunden, Kreditfälle) vorher abgleichen.
-- Firestore-Pfad steht jeweils im Kommentar. Diagramm: docs/DATENMODELL.md.

BEGIN;

-- ---------------------------------------------------------------- Aufzählungen
CREATE TYPE plan_id        AS ENUM ('insurance', 'investment', 'investment_vb', 'credit', 'realestate');
CREATE TYPE app_role       AS ENUM ('admin', 'lead', 'member', 'viewer');
CREATE TYPE financing_kind AS ENUM ('hauskauf', 'wohnungskauf', 'hausbau', 'umbau', 'sanierung', 'umschuldung', 'anlegerwohnung');
CREATE TYPE employment     AS ENUM ('unselbststaendig', 'selbststaendig');
CREATE TYPE todo_lane      AS ENUM ('todo', 'progress', 'berechnung', 'kunde', 'fertig');
CREATE TYPE todo_category  AS ENUM ('finanzierung', 'kunde', 'mitarbeiterkunde');
CREATE TYPE todo_color     AS ENUM ('grau', 'gruen', 'gelb', 'rot', 'blau');

-- ---------------------------------------------------------------- Mitarbeiter & Struktur
-- employees/{id} + Strukturbaum org/structure.tree (Knoten-ID = Mitarbeiter-ID)
CREATE TABLE employee (
  id          text PRIMARY KEY,
  name        text        NOT NULL,
  role        text,                                   -- Karrierestufe, z. B. "Trainee", "Teamleiter"
  manager_id  text        REFERENCES employee(id) ON DELETE SET NULL,   -- Elternknoten im Strukturbaum
  active      boolean     NOT NULL DEFAULT true,      -- false = nicht mehr im Baum
  is_new      boolean     NOT NULL DEFAULT false,
  joined_at   date,
  bonus       numeric(12,2) NOT NULL DEFAULT 0,       -- manuell erfasster Bonus (€)
  soll        numeric(12,2) NOT NULL DEFAULT 0,       -- Einheitenziel des Monats (kommt live aus plan_month.eh_ziel)
  ist         numeric(12,2) NOT NULL DEFAULT 0,       -- denormalisierte Summe von employee_plan_units.units
  -- Darstellung im Strukturbaum (Knoten-Eigenschaften)
  color       text,
  color2      text,                                   -- zweite Farbe für zweigeteilte Knoten
  status      text,
  sort_order  integer     NOT NULL DEFAULT 0
);
CREATE INDEX employee_manager_idx ON employee(manager_id);

-- Firestore speichert die Vorgesetztenkette als Array `ancestors` (für Rechteprüfung). Relational: Closure-Tabelle.
-- (Alternativ rekursive CTE oder ltree.) Pflege per Trigger/Job, wenn manager_id sich ändert.
CREATE TABLE employee_ancestor (
  employee_id text    NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  ancestor_id text    NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  depth       integer NOT NULL CHECK (depth >= 1),    -- 1 = direkter Vorgesetzter
  PRIMARY KEY (employee_id, ancestor_id)
);
CREATE INDEX employee_ancestor_anc_idx ON employee_ancestor(ancestor_id);

-- users/{uid} + employees/{id}/private/*  (bei Finova: SSO/bestehende Benutzerverwaltung)
CREATE TABLE app_user (
  uid                   text PRIMARY KEY,
  employee_id           text UNIQUE REFERENCES employee(id) ON DELETE CASCADE,   -- NULL = reiner Admin ohne Knoten
  email                 text NOT NULL UNIQUE,
  role                  app_role NOT NULL DEFAULT 'member',
  must_change_password  boolean  NOT NULL DEFAULT false,
  account_pending       boolean  NOT NULL DEFAULT true   -- wartet auf erste Anmeldung
);

-- employees/{id}.ehByPlan + .careerUnits  (je Mitarbeiter und Karriereplan)
CREATE TABLE employee_plan_units (
  employee_id  text    NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  plan         plan_id NOT NULL,
  units        numeric(12,2) NOT NULL DEFAULT 0,      -- Einheiten im laufenden Monat (ehByPlan)
  career_units numeric(12,2),                         -- kumuliert für Trainee-Stufen, wird beim Monatsabschluss NICHT zurückgesetzt
  PRIMARY KEY (employee_id, plan)
);

-- employees/{id}.vbByAbwickler (Anteil investment_vb je Abwickler)
CREATE TABLE employee_vb_abwickler (
  employee_id  text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  abwickler_id text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  units        numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (employee_id, abwickler_id)
);

-- employees/{id}.monthStats (serverberechnete Monatssummen, für alle lesbar). Kann auch eine View über plan_week sein.
CREATE TABLE employee_month_stats (
  employee_id text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  month       char(7) NOT NULL,                       -- 'YYYY-MM' (Umsatzmonat)
  at_plan integer NOT NULL DEFAULT 0, at_ist integer NOT NULL DEFAULT 0,
  bt_plan integer NOT NULL DEFAULT 0, bt_ist integer NOT NULL DEFAULT 0,
  st_plan integer NOT NULL DEFAULT 0, st_ist integer NOT NULL DEFAULT 0,
  et_plan integer NOT NULL DEFAULT 0, et_ist integer NOT NULL DEFAULT 0,
  soll    numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (employee_id, month)
);

-- org/structure.notes (Notizen je Knoten) und .conns (Verbindungen im Baum)
CREATE TABLE org_note (
  id          bigserial PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  text        text NOT NULL,
  noted_on    text                                    -- im Original Freitext/Datum als String
);
CREATE TABLE org_connection (
  id      bigserial PRIMARY KEY,
  from_id text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  to_id   text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  label   text
);

-- org/structure.planRates: Euro pro Einheit je Karrierestufe und Karriereplan
CREATE TABLE plan_rate (
  plan          plan_id NOT NULL,
  stage         text    NOT NULL,
  euro_per_unit numeric(10,2) NOT NULL,
  PRIMARY KEY (plan, stage)
);

-- org/careerPlans.plans[] (Guide-Inhalte als HTML)
CREATE TABLE career_plan (
  id         text PRIMARY KEY,
  title      text NOT NULL,
  html       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- org/teamGoal: aktuelles Teamziel (genau eine aktive Zeile) + Verlauf
CREATE TABLE team_goal (
  id             serial PRIMARY KEY,
  note           text    NOT NULL DEFAULT '',
  recruit_goal   integer NOT NULL DEFAULT 0,
  recruit_actual integer,
  period_start   date    NOT NULL,
  period_end     date    NOT NULL,
  is_current     boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX team_goal_current_idx ON team_goal(is_current) WHERE is_current;
CREATE TABLE team_history (
  day date PRIMARY KEY,
  ist numeric(12,2) NOT NULL                          -- Summe aller Mitarbeiter an diesem Tag
);

-- ---------------------------------------------------------------- Controlling / Planung
-- employees/{id}/planWeeks/{YYYY-Www}
CREATE TABLE plan_week (
  employee_id      text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  week             char(8) NOT NULL,                  -- 'YYYY-Www'
  atz integer NOT NULL DEFAULT 0, atg integer NOT NULL DEFAULT 0,
  analysen_z integer NOT NULL DEFAULT 0, analysen integer NOT NULL DEFAULT 0,
  beratungen_z integer NOT NULL DEFAULT 0, beratungen integer NOT NULL DEFAULT 0,
  vertraege integer NOT NULL DEFAULT 0, pg integer NOT NULL DEFAULT 0,
  stz integer NOT NULL DEFAULT 0, stg integer NOT NULL DEFAULT 0,
  etz integer NOT NULL DEFAULT 0, etg integer NOT NULL DEFAULT 0,
  eh_offen numeric(12,2) NOT NULL DEFAULT 0, eh_gemacht numeric(12,2) NOT NULL DEFAULT 0,
  aktivitaeten_soll integer NOT NULL DEFAULT 0, aktivitaeten_ist integer NOT NULL DEFAULT 0,
  notes     text NOT NULL DEFAULT '',
  submitted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (employee_id, week)
);

-- employees/{id}/planMonthNotes/{YYYY-MM}
CREATE TABLE plan_month (
  employee_id text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  month       char(7) NOT NULL,
  at_note text NOT NULL DEFAULT '', bt_note text NOT NULL DEFAULT '',
  st_note text NOT NULL DEFAULT '', et_note text NOT NULL DEFAULT '',
  feedback text NOT NULL DEFAULT '',
  eh_ziel  numeric(12,2),                             -- Einheitenziel des Monats (= Soll auf der Mitarbeiterseite)
  PRIMARY KEY (employee_id, month)
);

-- employees/{fkId}/planAnnual/{YYYY} (je Führungskraft) + Quartale
CREATE TABLE plan_annual (
  employee_id text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,   -- Führungskraft
  year        smallint NOT NULL,
  vertraege integer NOT NULL DEFAULT 0, einheiten integer NOT NULL DEFAULT 0,
  atg integer NOT NULL DEFAULT 0, analysen integer NOT NULL DEFAULT 0, beratungen integer NOT NULL DEFAULT 0,
  PRIMARY KEY (employee_id, year)
);
CREATE TABLE plan_quarter (
  employee_id text NOT NULL,
  year        smallint NOT NULL,
  quarter     smallint NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  milestone   text NOT NULL DEFAULT '',
  vertraege integer NOT NULL DEFAULT 0, einheiten integer NOT NULL DEFAULT 0,
  atg integer NOT NULL DEFAULT 0, analysen integer NOT NULL DEFAULT 0, beratungen integer NOT NULL DEFAULT 0,
  PRIMARY KEY (employee_id, year, quarter),
  FOREIGN KEY (employee_id, year) REFERENCES plan_annual(employee_id, year) ON DELETE CASCADE
);

-- employees/{id}/attendance/* (aktueller Stand je Mitarbeiter)
CREATE TABLE attendance (
  employee_id     text PRIMARY KEY REFERENCES employee(id) ON DELETE CASCADE,
  seminar         boolean NOT NULL DEFAULT false,
  seminar_reason  text    NOT NULL DEFAULT '',
  training        boolean NOT NULL DEFAULT false,
  training_reason text    NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------- Fachdaten
-- employees/{id}/todos/{todoId}  (persönliches Board, nur für den Besitzer sichtbar)
CREATE TABLE board_todo (
  id          text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  due_date    date,
  lane        todo_lane     NOT NULL DEFAULT 'todo',
  category    todo_category NOT NULL,
  color       todo_color    NOT NULL DEFAULT 'grau',
  flagged     boolean NOT NULL DEFAULT false,
  completed   boolean NOT NULL DEFAULT false,
  archived    boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX board_todo_emp_idx ON board_todo(employee_id);

-- financings/{caseId}: ownerId = Betreuer, abwicklerId = zugewiesener Abwickler, ancestors -> employee_ancestor
CREATE TABLE financing_case (
  id            text PRIMARY KEY,
  owner_id      text NOT NULL REFERENCES employee(id),   -- Betreuer
  abwickler_id  text REFERENCES employee(id),
  name          text NOT NULL,                           -- Kunde/Fallbezeichnung
  amount        numeric(14,2) NOT NULL DEFAULT 0,
  kind          financing_kind NOT NULL,
  employment    employment     NOT NULL,
  aufbereitet   boolean NOT NULL DEFAULT false,
  eingereicht   boolean NOT NULL DEFAULT false,
  kreditvertrag boolean NOT NULL DEFAULT false,
  archived      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX financing_owner_idx ON financing_case(owner_id);
CREATE INDEX financing_abwickler_idx ON financing_case(abwickler_id);

-- financings/{caseId}.docs (Checkliste: Unterlagen-ID -> abgehakt; Katalog in src/lib/data/finanzierung.ts)
CREATE TABLE financing_doc_check (
  case_id text NOT NULL REFERENCES financing_case(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  PRIMARY KEY (case_id, item_id)
);

-- sales/{id}: Umsatzverfolgung, eine Zeile je im EH-Rechner gebuchter Position
CREATE TABLE sale (
  id            text PRIMARY KEY,
  owner_id      text NOT NULL REFERENCES employee(id),   -- Mitarbeiter, auf den gebucht wurde
  booked_at     timestamptz NOT NULL,
  produkt       text NOT NULL,
  praemie       numeric(14,2) NOT NULL DEFAULT 0,
  praemie_label text NOT NULL DEFAULT '',                -- z. B. "Mtl. Prämie (€)"
  einheiten     numeric(12,2) NOT NULL DEFAULT 0,
  kunde         text NOT NULL DEFAULT '',                -- nachträglich eintragbar
  beginn        date,                                    -- nachträglich eintragbar
  policiert     boolean NOT NULL DEFAULT false,
  ausbezahlt    boolean NOT NULL DEFAULT false
);
CREATE INDEX sale_owner_idx ON sale(owner_id, booked_at DESC);

-- celebrations/{id}: Ereignis für den Konfettiregen (kurzlebig; bei Finova evtl. Event/WebSocket statt Tabelle)
CREATE TABLE celebration (
  id   bigserial PRIMARY KEY,
  name text   NOT NULL CHECK (char_length(name) <= 80),
  at   bigint NOT NULL                                   -- Unix-ms wie im Original
);

-- ---------------------------------------------------------------- Monatsarchiv (unveränderlich nach Abschluss)
-- snapshots/{YYYY-MM}
CREATE TABLE month_snapshot (
  month          char(7) PRIMARY KEY,
  version        smallint NOT NULL DEFAULT 1,
  closed_at      timestamptz NOT NULL,
  closed_by      text,                                   -- E-Mail, rein informativ
  goal_note      text NOT NULL DEFAULT '',
  recruit_goal   integer NOT NULL DEFAULT 0,
  recruit_actual integer,
  period_start   date NOT NULL,
  period_end     date NOT NULL
);
CREATE TABLE snapshot_history (
  month char(7) NOT NULL REFERENCES month_snapshot(month) ON DELETE CASCADE,
  day   date    NOT NULL,
  ist   numeric(12,2) NOT NULL,
  PRIMARY KEY (month, day)
);
-- snapshots/{month}.rows + snapshots/{month}/employees/{id}
CREATE TABLE snapshot_employee (
  month       char(7) NOT NULL REFERENCES month_snapshot(month) ON DELETE CASCADE,
  employee_id text    NOT NULL,                          -- bewusst ohne FK: Mitarbeiter kann später gelöscht werden
  name        text    NOT NULL,
  role        text,
  soll numeric(12,2) NOT NULL DEFAULT 0, ist numeric(12,2) NOT NULL DEFAULT 0,
  bonus numeric(12,2) NOT NULL DEFAULT 0, is_new boolean NOT NULL DEFAULT false, joined_at date,
  at_plan integer, at_ist integer, bt_plan integer, bt_ist integer,
  st_plan integer, st_ist integer, et_plan integer, et_ist integer,
  PRIMARY KEY (month, employee_id)
);
CREATE TABLE snapshot_employee_units (
  month        char(7) NOT NULL,
  employee_id  text    NOT NULL,
  plan         plan_id NOT NULL,
  units        numeric(12,2) NOT NULL DEFAULT 0,
  career_units numeric(12,2),
  PRIMARY KEY (month, employee_id, plan),
  FOREIGN KEY (month, employee_id) REFERENCES snapshot_employee(month, employee_id) ON DELETE CASCADE
);
-- eingefrorener Strukturbaum des Monats (orgChart.tree/notes/conns/planRates)
CREATE TABLE snapshot_org_node (
  month text NOT NULL, node_id text NOT NULL, parent_id text,
  name text NOT NULL, role text, color text, color2 text, status text, sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (month, node_id),
  FOREIGN KEY (month) REFERENCES month_snapshot(month) ON DELETE CASCADE
);
CREATE TABLE snapshot_org_note (
  id bigserial PRIMARY KEY, month text NOT NULL REFERENCES month_snapshot(month) ON DELETE CASCADE,
  node_id text NOT NULL, text text NOT NULL, noted_on text
);
CREATE TABLE snapshot_org_connection (
  id bigserial PRIMARY KEY, month text NOT NULL REFERENCES month_snapshot(month) ON DELETE CASCADE,
  from_id text NOT NULL, to_id text NOT NULL, label text
);
CREATE TABLE snapshot_plan_rate (
  month text NOT NULL REFERENCES month_snapshot(month) ON DELETE CASCADE,
  plan plan_id NOT NULL, stage text NOT NULL, euro_per_unit numeric(10,2) NOT NULL,
  PRIMARY KEY (month, plan, stage)
);

-- org/archiveIndex.months[]: vorberechnete Monatsaggregate (ableitbar -> auch als Materialized View möglich)
CREATE TABLE month_totals (
  month          char(7) PRIMARY KEY REFERENCES month_snapshot(month) ON DELETE CASCADE,
  label          text NOT NULL,                          -- "Juni 2026"
  soll numeric(12,2) NOT NULL, ist numeric(12,2) NOT NULL, pct integer NOT NULL,
  at_plan integer NOT NULL, at_ist integer NOT NULL,
  bt_plan integer NOT NULL, bt_ist integer NOT NULL,
  et_plan integer NOT NULL, et_ist integer NOT NULL,
  eh_insurance numeric(12,2) NOT NULL DEFAULT 0, eh_investment numeric(12,2) NOT NULL DEFAULT 0,
  eh_investment_vb numeric(12,2) NOT NULL DEFAULT 0, eh_credit numeric(12,2) NOT NULL DEFAULT 0,
  eh_realestate numeric(12,2) NOT NULL DEFAULT 0,
  total_eur      numeric(14,2) NOT NULL,                 -- Summe aller Vergütungen
  employee_count integer NOT NULL, new_hire_count integer NOT NULL,
  recruit_goal   integer NOT NULL, recruit_actual integer NOT NULL
);

COMMIT;
