# Übernahme in die Finova-App (Angular + Tailwind)

Dieses Dashboard ist React 19 + Vite + Tailwind v4 + Firebase. Die offizielle Finova-App ist Angular mit Tailwind
(`app-root`, Tailwind-Klassen wie `px-4`). Die React-Komponenten lassen sich daher nicht einhängen; Design, Rechenlogik und
Datenmodell lassen sich übernehmen. Der Branch `go-live` hat das Design bereits an Finova angeglichen.

## 1. Was 1:1 übernommen werden kann

| Was | Wo | Hinweis |
|---|---|---|
| Rechen- und Fachlogik | `src/lib/calc/*` | Reines TypeScript. Einzige Ausnahme: `fieldDiff.ts` importiert `deleteField`/`FieldPath` aus `firebase/firestore`. |
| Tests der Logik | `test/calc/*`, `test/legacy-fixtures`, `test/fixtures` | Laufen mit Vitest oder Jest weiter; Golden-Tests sichern die Zahlen. |
| Typen / Datenmodell | `src/types/*`, `src/lib/data/*` | Dokumentstruktur: siehe Abschnitt 4. |
| Sicherheitsregeln als Vorlage | `firestore.rules`, `test/rules` | Das Rechte-Modell (Admin, Führungskraft, Mitarbeiter, Nur-Lesen) muss serverseitig bei Finova nachgebaut werden (Abschnitt 4). |
| Serverlogik als Vorlage | `functions/src/*` | Monatsabschluss, Karrierestufen, Statistik; wird zu Backend-Jobs bei Finova. |
| Design-Tokens | `src/finova-theme.css` | Siehe Abschnitt 2. |

## 2. Design

Alle Farben, der Radius und die Schrift stehen in **`src/finova-theme.css`** (Tailwind-v4-Syntax: `:root` + `@theme inline`).
Die Werte wurden aus Referenz-Screenshots der Finova-App gemessen (Primärgrün `#3ee08e`, Hintergrund `#f9fafb`, Schrift
Plus Jakarta Sans).

- **Tailwind v4 in Finova:** Datei importieren oder die Variablen in deren Theme einsetzen.
- **Tailwind v3 in Finova (`tailwind.config.js`):** Die Tokens als `theme.extend.colors` eintragen, z. B.
  `'finova-green': '#3ee08e'`, `'finova-soft': '#ecfdf3'`, `'finova-border': '#cdf5de'`, `'finova-ink': '#047857'`,
  `primary: '#3ee08e'`, `'primary-foreground': '#0f172a'`, `background: '#f9fafb'`. Die im Code verwendeten Klassen
  (`bg-primary`, `text-finova-ink`, `border-finova-border`, `bg-finova-soft`) funktionieren dann unverändert.
- **Eigene Finova-Variablen vorhanden?** Dann nur die rechte Seite in `finova-theme.css` auf deren Variablen zeigen lassen.

### Wiederkehrende Bausteine (Rezepte)
Quelle: `src/components/ui/surface.tsx`, `button.tsx`, `card.tsx`.

- **Seitentitel:** `text-2xl font-extrabold uppercase`, darunter grauer Text `text-sm text-slate-500`.
- **Karte:** `rounded-xl border border-finova-border bg-card`; Titel `text-sm font-bold uppercase tracking-wide`, davor Icon in
  `size-8 rounded-lg bg-finova-soft` (`CardIcon`).
- **Sektionskarte:** grüner Kopfbalken `bg-primary px-5 py-3` mit `text-sm font-extrabold uppercase` (`SectionCard`).
- **Buttons:** primär `bg-primary text-primary-foreground font-bold rounded-lg`; outline `border-slate-200 bg-card`; soft
  `border-finova-border bg-finova-soft text-finova-ink`; sekundär `bg-slate-200 text-slate-600`.
- **Badge:** `rounded-full px-2.5 py-0.5 text-xs font-semibold` in grün, blau, amber, rot oder grau (`Badge`).
- **Filter-Tabs:** `rounded-lg border px-3 py-1.5 text-sm font-bold`, aktiv `bg-primary`.
- **Tabelle:** Kopf `text-[11px] font-bold uppercase text-slate-500 bg-background`, Zeilen `border-b border-slate-200`,
  kein Zebra (`SURFACE_TABLE`).
- **Diagramme:** Chart.js; Gitter `#e2e8f0`, Ticks `#64748b` (`src/lib/chartSetup.ts`).

## 3. Was neu gebaut werden muss

- **Komponenten** (`src/components/**/*.tsx`): als Angular-Komponenten. Größte Brocken: `Overview`, `Team`, `Planung`
  (Woche/Monat/Jahr), `Umsatzverfolgung`, `Finanzierungen`, `StrukturBaum` (SVG, ca. 1.300 Zeilen), `Rechner/*`, `MeinBoard`.
- **Hooks** (`src/hooks/*`): zu Angular-Services (einzige Stelle mit Firestore-Zugriff). `useAuth`, `useDashboardDoc`, `usePlanungDoc`, `useUmsaetzeDoc` usw. kapseln
  die Firestore-Listener; Logik daraus lässt sich fast direkt nach RxJS/Signals übertragen (`@angular/fire`).
- **Diagramme:** `ng2-charts` oder Chart.js direkt.
- **UI-Basis:** Radix-Dialoge werden durch das ersetzt, was Finova verwendet (CDK Dialog o. Ä.).

Empfohlene Reihenfolge: (1) Tokens/Theme, (2) Services + `lib/calc` einbinden, (3) kleine Seiten (Profil, Partner, Guide),
(4) Dashboard und Mitarbeiter, (5) Controlling/Umsatz/Finanzierungen, (6) Strukturbaum und Rechner.

## 4. Datenbank: Firestore heute, Finova-Backend morgen

### Ausgangslage
- Heute: **Cloud Firestore** (NoSQL-Dokumentendatenbank, Projekt `finova-team-dashboard`, Region eur3). Kein SQL, keine Tabellen:
  Collections enthalten Dokumente (JSON-artig, verschachtelt), Beziehungen laufen über gespeicherte IDs/Namen, es gibt keine Joins.
- Konfiguration: `.firebaserc`, `firebase.json`, `src/lib/firebase.ts`. Emulatoren: `npm run emulators`.
- Auth: Firebase Auth (E-Mail/Passwort); Rolle und Zuordnung zum Mitarbeiter-Knoten in `users/{uid}` (`useAuth.ts`, `roles.ts`).
- **Entscheidung (User):** Das Firebase-Projekt kann *nicht* behalten werden, weil sonst alle Finova-Mitarbeiter zusätzlich
  angelegt werden müssten. Die integrierte App soll stattdessen auf **Finovas Datenbank und Benutzerverwaltung** zugreifen
  (alle Datenbankobjekte lesen, ändern, anzeigen; auch aus dem Finova-Netzwerk), damit das Controlling automatisch übernommen wird.
- Konsequenz: Firestore wird durch Finovas Backend ersetzt. Die App darf dann **nicht direkt** aus dem Browser auf die DB
  zugreifen, sondern über eine API mit serverseitiger Rechteprüfung (in Firestore übernehmen das heute `firestore.rules`).

### Aktuelle Datenstruktur (Firestore)
| Pfad | Inhalt | Besonderheiten |
|---|---|---|
| `users/{uid}` | Konto, Rolle, Verknüpfung zum Mitarbeiter | nur lesbar, geschrieben von Cloud Functions |
| `employees/{id}` | Stammdaten + Monatssummen: `name`, `soll`, `ist`, `ehByPlan`, `vbByAbwickler`, `careerUnits`, `bonus`, `joinDate`, `monthStats`, `ancestors` | `ancestors` (Vorgesetztenkette) und `monthStats` sind denormalisiert/serverberechnet |
| `employees/{id}/private/*` | uid, E-Mail, "wartet auf erste Anmeldung" | nur Cloud Functions schreiben |
| `employees/{id}/planWeeks/{YYYY-Www}` | Wochenplan je Mitarbeiter (AT/BT/ST/ET Soll/Ist, EH, Notizen) | in der App nach Mitarbeitername zu `entries` zusammengesetzt |
| `employees/{id}/planMonthNotes/{YYYY-MM}` | Monatsnotizen, Einheitenziel `ehZiel` | dito |
| `employees/{id}/planAnnual/{YYYY}` | Jahresziele + Quartalsmeilensteine je Führungskraft | |
| `employees/{id}/attendance/*` | Anwesenheit (Seminar/Training + Grund) | |
| `employees/{id}/todos/*` | Board-Todos (Lane, Kategorie, Farbe, Fälligkeit, Reihenfolge) | mehrere Todos als **Array in einem Dokument** |
| `financings/{caseId}` | Kreditfälle (`cases[]`: Name, Betrag, Art, Beschäftigung, Betreuer, Abwickler, Checkliste `docs`, Status-Flags) | Array eingebettet |
| `sales/{id}` | Umsatzverfolgung: Buchung aus dem EH-Rechner (Produkt, Prämie, Einheiten, Kunde, Beginn, policiert, ausbezahlt) | |
| `celebrations/{id}` | Feier-/Konfetti-Ereignisse | |
| `org/structure` (`org/{docId}`) | Strukturbaum (`tree` verschachtelt, `notes`, `conns`, `planRates`) | Baum als **ein JSON-Dokument** |
| `org/teamGoal`, `org/archiveIndex` | Teamziel + Verlauf, Index der Monatsarchive | |
| `snapshots/{YYYY-MM}` (+ `/employees/{id}`) | Monatsarchiv (eingefrorener Stand beim Monatsabschluss) | |
| Storage `avatars/…` | Profilbilder | Dateien, nicht Firestore |

Typdefinitionen: `src/types/dashboard.ts`, `src/types/archive.ts`, `EmployeeRow` in `src/lib/calc/format.ts`, `SbNode` in
`src/lib/calc/struktur.ts`.

### Was an Firestore hängt und im Zielsystem ersetzt werden muss
1. **Zugriffsrechte:** `firestore.rules` (Admin, Führungskraft, Mitarbeiter, Nur-Lesen; Vorgesetzte sehen den Teilbaum über
   `ancestors`). Muss serverseitig in der Finova-API nachgebaut werden. Die Regeltests in `test/rules` zeigen das gewünschte
   Verhalten und lassen sich als Vorlage für API-Tests nutzen.
2. **Serverlogik:** `functions/src/*` (Monatsabschluss, Karrierestufen, Statistik, Backup, Kontoanlage). Wird zu Backend-Jobs
   oder Services bei Finova; die Berechnung selbst steckt in `src/lib/calc` und `functions/shared`.
3. **Live-Updates:** Die App nutzt `onSnapshot` (Echtzeit). Mit REST braucht es Polling, WebSocket oder SSE.
4. **Eingebettete Arrays/Maps:** Todos, Kreditfälle, Wochenplan-`entries` und der Strukturbaum liegen als Array bzw. Objekt
   in einem Dokument. In SQL werden das eigene Tabellen/Zeilen (siehe Vorschlag).
5. **Mitarbeiter und Anmeldung:** Statt `users`/`employees/private` kommen Finovas bestehende Mitarbeiter und deren Login (SSO).
   Der Strukturbaum/`ancestors` muss aus Finovas Organisationsdaten abgeleitet oder weitergepflegt werden.

### Vorschlag: Abbildung auf ein relationales Modell (falls Finova SQL nutzt)
| Tabelle | Quelle | Wichtige Spalten |
|---|---|---|
| `employee` | `employees/{id}` | id, name, role, parent_id (Strukturbaum), joined_at, bonus, is_new |
| `employee_units` | `ehByPlan`, `careerUnits`, `vbByAbwickler` | employee_id, plan, month/kumuliert, units |
| `org_node` | `org/structure.tree` | id, parent_id, name, role, color, status, sort_order |
| `org_note`, `org_connection` | `notes`, `conns` | node_id, text, date / from_id, to_id, label |
| `plan_rate` | `planRates` | plan, stage, euro_per_unit |
| `plan_week` | `planWeeks` | employee_id, week, atz, atg, analysen_z, …, submitted |
| `plan_month` | `planMonthNotes` | employee_id, month, at/bt/st/et/feedback, eh_ziel |
| `plan_annual`, `plan_quarter` | `planAnnual` | manager_id, year, Ziele / Quartal, Meilenstein |
| `attendance` | `attendance` | employee_id, date, seminar, training, Gründe |
| `board_todo` | `todos` | employee_id, title, description, due_date, lane, category, color, flagged, completed, archived, sort_order |
| `financing_case` (+ `financing_doc_check`) | `financings.cases[]`, `docs` | id, name, amount, kind, employment, advisor_id, handler_id, flags, created_at |
| `sale` | `sales` | id, booked_at, employee_id, product, premium, units, customer, start_date, policed, paid_out |
| `month_snapshot` (+ Detailtabellen) | `snapshots` | month, closed_at, Zeilen je Mitarbeiter |
| `team_goal` | `org/teamGoal` | Periode, Ziel, Verlaufspunkte |

Das ist ein Entwurf, der mit Finovas vorhandenem Schema abgeglichen werden muss (vermutlich existieren Mitarbeiter-, Kunden-
und Kreditfall-Tabellen schon; dann nur verknüpfen statt neu anlegen).

### Datenmigration / Dump
- **Vorhanden:** `scripts/backup/README.md` (gcloud-Export in einen Bucket, geplante Backups, Restore) und
  `functions/src/backup.ts`. Das Exportformat ist ein Firestore-Binärformat, gut für Backup/Restore, aber nicht lesbar.
- **Für die Migration** braucht es zusätzlich einen **JSON-Dump** (Node-Skript mit `firebase-admin`, liest alle Collections und
  Subcollections rekursiv; `firebase-admin` ist bereits Dependency). Daraus: (1) Schema-Inventar aus den echten Daten prüfen
  (Altbestände ohne neue Felder, z. B. fehlendes `ehByPlan`), (2) ETL-Skript ins Zielschema, (3) Stichprobenvergleich der
  Summen (Golden-Tests in `test/calc` als Maßstab).
- Empfohlene Reihenfolge: Datenzugriff in der App hinter eine Schnittstelle legen (die Hooks in `src/hooks/*` sind die einzige
  Stelle mit Firestore), Zielsystem gegen diese Schnittstelle bauen, dann Daten migrieren.

### Fragen an die Finova-Entwickler
1. Welche Datenbank und welches Backend? Gibt es eine REST-/GraphQL-API, und darf unsere App direkt auf die DB (z. B. Lesezugriff
   auf Reporting-Views) oder nur über die API?
2. Wie läuft die Anmeldung (SSO/OIDC/SAML)? Woher kommen Rollen und die Vorgesetztenhierarchie?
3. Welche Daten existieren schon (Mitarbeiter, Kunden, Kreditfälle, Umsätze) und welche kommen neu hinzu?
4. Dürfen wir neue Tabellen anlegen und serverseitige Jobs betreiben (Monatsabschluss, Karrierestufen)?
5. Erreichbarkeit: Läuft die App im Finova-Netzwerk/hinter VPN, und gibt es Vorgaben für Hosting und Datenschutz (DSGVO)?

## 5. Offene Punkte
- Tailwind-Version in Finova (v3 oder v4) und vorhandene Design-Variablen klären.
- Datenbank/Backend von Finova und Zugriffsweg klären (Abschnitt 4); davon hängt der Umfang der Portierung ab.
- Charts: Datenfarben in `src/lib/calc/struktur.ts` und `rendite.ts` sind noch teils dunkle Teal-Töne.
- Der Look wurde bisher am Testserver geprüft, nicht gegen jede Finova-Seite im Detail.
