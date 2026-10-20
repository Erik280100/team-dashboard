# Cloud Functions

| Funktion | Typ | Zweck |
|---|---|---|
| `inviteUser` | callable (Admin) | Konto anlegen/aktualisieren (zufälliges Einmal-Passwort, einmalig zurückgegeben; Änderungspflicht beim ersten Login), Rolle als Custom Claim setzen, Konto in `employees/{id}/private/account` verknüpfen |
| `createAccount` | callable (Admin oder Vorgesetzte) | Konto für eine Person aus dem Strukturbaum erstellen (Button „Useraccount erstellen“): Admin für alle, sonst nur Unterstruktur; Rolle aus der Stufe (lead/member), zufälliges Einmal-Passwort, `accountPending` in `employees/{id}/private/account` bis zur ersten Passwortänderung |
| `setInitialPassword` | callable (angemeldet, nur mit Claim `mustChangePassword`) | Erstes eigenes Passwort serverseitig setzen und erst danach die Änderungspflicht aufheben |
| `disableUser` | callable (Admin) | Konto sperren |
| `onStructureChange` | Firestore-Trigger auf `org/structure` | `employees/{id}`: Name/Rolle/`managerId`/`ancestors` nachziehen, neue Mitarbeiter anlegen, entfernte deaktivieren (und deren Login sperren), `ancestors` der Finanzierungen aktualisieren; schreibt nur tatsächliche Änderungen |
| `backupNow` | callable (Admin) | Firestore-Export in den Backup-Bucket; der Client ruft das vor jedem Monatsabschluss auf (bricht bei Fehler ab) |
| `weeklyBackup` | geplant (So 03:00 Wien) | Wöchentlicher Export in den Backup-Bucket |

## Einrichtung (einmalig)

1. Blaze-Tarif aktivieren, Budget-Alarm setzen.
2. Backup-Bucket anlegen (siehe `scripts/backup/README.md`, Abschnitt 3). Anderer Name: Umgebungsvariable `BACKUP_BUCKET`.
3. Berechtigungen für das Standard-Dienstkonto der Functions (`<PROJEKT-NUMMER>-compute@developer.gserviceaccount.com`):
   - Rolle **Cloud Datastore Import Export Admin** (`roles/datastore.importExportAdmin`)
   - Rolle **Storage Admin** auf dem Backup-Bucket (`roles/storage.admin`)
4. Region: `europe-west1` (in `src/index.ts` und `src/lib/firebase.ts`). Muss zur Standortwahl der Datenbank passen, sonst höhere Latenz.
5. Deploy: `cd functions && npm install && cd .. && npx firebase deploy --only functions`.

## Reihenfolge beim Livegang

Siehe Umbauplan: Backups einrichten → Migration (Trockenlauf, dann Staging, dann produktiv) → Functions deployen →
Admin-Konto anlegen und Claim setzen → Konten einladen → erst dann `firebase deploy --only firestore:rules`.

## Erstes Admin-Konto (Henne-Ei-Problem)

`inviteUser` verlangt einen Admin. Das erste Admin-Konto wird einmalig per Skript/Konsole angelegt:
Auth-Nutzer in der Firebase-Konsole erstellen und dann mit dem Admin SDK die Claims setzen:
`getAuth().setCustomUserClaims(uid, { role: "admin", employeeId: "<Knoten-ID>" })`.
(Die bestehenden Editor-Konten gelten bis dahin dank der Übergangsregel in `src/lib/calc/roles.ts` als Admin im Frontend,
haben aber **keine** Claims — die neuen Security Rules würden sie aussperren.)
