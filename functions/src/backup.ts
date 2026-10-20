import { v1 } from "@google-cloud/firestore"

const BUCKET = process.env.BACKUP_BUCKET || "finova-team-dashboard-backups"

/** Startet einen Firestore-Export nach gs://<BUCKET>/<kind>-<Zeitstempel>. Gibt den Zielpfad zurück. */
export async function exportFirestore(kind: "manual" | "weekly" | "pre-close"): Promise<string> {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
  if (!project) throw new Error("Projekt-ID unbekannt")
  const client = new v1.FirestoreAdminClient()
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outputUriPrefix = `gs://${BUCKET}/${kind}-${stamp}`
  await client.exportDocuments({ name: client.databasePath(project, "(default)"), outputUriPrefix, collectionIds: [] })
  return outputUriPrefix
}
