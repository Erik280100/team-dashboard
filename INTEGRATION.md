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
| Sicherheitsregeln | `firestore.rules`, `storage.rules`, `test/rules` | Rechte-Modell (Admin, Führungskraft, Mitarbeiter, Nur-Lesen) hängt daran. |
| Cloud Functions | `functions/src/*` | Monatsabschluss, Karrierestufen, Statistik, Backup. Unabhängig vom Frontend. |
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
- **Hooks** (`src/hooks/*`): zu Angular-Services. `useAuth`, `useDashboardDoc`, `usePlanungDoc`, `useUmsaetzeDoc` usw. kapseln
  die Firestore-Listener; Logik daraus lässt sich fast direkt nach RxJS/Signals übertragen (`@angular/fire`).
- **Diagramme:** `ng2-charts` oder Chart.js direkt.
- **UI-Basis:** Radix-Dialoge werden durch das ersetzt, was Finova verwendet (CDK Dialog o. Ä.).

Empfohlene Reihenfolge: (1) Tokens/Theme, (2) Services + `lib/calc` einbinden, (3) kleine Seiten (Profil, Partner, Guide),
(4) Dashboard und Mitarbeiter, (5) Controlling/Umsatz/Finanzierungen, (6) Strukturbaum und Rechner.

## 4. Firebase

- Projekt/Konfiguration: `.firebaserc`, `firebase.json`, `src/lib/firebase.ts`. Emulatoren: `npm run emulators`.
- Auth: E-Mail/Passwort; Rollen und Zuordnung zum Mitarbeiter-Knoten liegen in den Konto-Dokumenten (`useAuth.ts`,
  `src/lib/calc/roles.ts`).
- Wichtige Daten: Mitarbeiter (inkl. `ancestors`, `monthStats`), Organigramm, Planung, Umsätze, Finanzierungen, Board-Todos,
  Monatsarchiv. Die Regeln erzwingen, dass man fremde Zeilen nur lesen darf, wenn die Rolle es erlaubt
  (`firestore.rules`, getestet in `test/rules`).
- **Entscheidung für die Übernahme:** Läuft die offizielle Finova-App auf demselben Firebase-Projekt oder einem eigenen? Davon
  hängen Auth, Regeln und Datenmigration ab.

## 5. Offene Punkte
- Tailwind-Version in Finova (v3 oder v4) und vorhandene Design-Variablen klären.
- Charts: Datenfarben in `src/lib/calc/struktur.ts` und `rendite.ts` sind noch teils dunkle Teal-Töne.
- Der Look wurde bisher am Testserver geprüft, nicht gegen jede Finova-Seite im Detail.
