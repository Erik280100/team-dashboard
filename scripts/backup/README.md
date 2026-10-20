# Backup & Restore (Firestore)

Projekt: `finova-team-dashboard`. Aufbewahrung: 3 Monate (rollierend).
Voraussetzung: Blaze-Tarif + Budget-Alarm. Einmalig `gcloud auth login` und
`gcloud config set project finova-team-dashboard`.
Hinweis: Limits/Flags vor dem Ausfuehren mit `gcloud firestore backups schedules create --help` pruefen.

## 1. Geplante Backups
```
# woechentlich, 14 Wochen (= 98 Tage) Aufbewahrung
gcloud firestore backups schedules create --database='(default)' --recurrence=weekly --day-of-week=SUN --retention=14w

# taeglich, 7 Tage Aufbewahrung
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=7d

gcloud firestore backups schedules list --database='(default)'
```

## 2. Point-in-Time-Recovery + Loeschschutz
```
gcloud firestore databases update --database='(default)' --enable-pitr --delete-protection
```

## 3. Eigener Export-Bucket (90 Tage Lebenszyklus)
```
gcloud storage buckets create gs://finova-team-dashboard-backups --location=<REGION-DER-DB>
gcloud storage buckets update gs://finova-team-dashboard-backups --lifecycle-file=scripts/backup/lifecycle.json
```

## 4. Manueller Export (vor Migration / riskanten Aenderungen)
```
gcloud firestore export gs://finova-team-dashboard-backups/manual-$(date +%Y%m%d-%H%M)
```

## 5. Restore (immer in NEUE Datenbank, nie ueber die produktive)
```
gcloud firestore backups list
gcloud firestore databases restore --source-backup=<BACKUP-RESSOURCE> --destination-database=restore-test
# oder aus Export:
gcloud firestore import gs://finova-team-dashboard-backups/<ORDNER> --database=restore-test
```
Danach Stichproben/Summen vergleichen und Daten gezielt uebernehmen.
