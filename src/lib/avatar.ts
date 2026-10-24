// Profilbilder: im Browser auf ein kleines Quadrat verkleinern (~15–30 KB statt mehrerer MB vom Handy) und in
// Cloud Storage unter avatars/{employeeId}.webp ablegen (siehe storage.rules). employees/{id}.avatarVersion
// markiert "hat ein Bild" und dient als Cache-Buster; die Download-URL wird je Version nur einmal geholt.
import { deleteField, doc, updateDoc } from "firebase/firestore"
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { firestore, storage } from "@/lib/firebase"

export const AVATAR_SIZE = 256
/** Obergrenze der gespeicherten Datei — muss zu storage.rules passen. */
export const AVATAR_MAX_BYTES = 200 * 1024

/** Mittiger quadratischer Ausschnitt eines w×h-Bildes. */
export function squareCrop(w: number, h: number): { sx: number; sy: number; size: number } {
  const size = Math.min(w, h)
  return { sx: Math.round((w - size) / 2), sy: Math.round((h - size) / 2), size }
}

export type Crop = { sx: number; sy: number; size: number }

/** Quadratischer Ausschnitt bei Zoom ≥ 1 (1 = ganze kurze Seite), so verschoben, dass er im w×h-Bild bleibt. */
export function cropAt(w: number, h: number, zoom: number, sx: number, sy: number): Crop {
  const size = Math.min(w, h) / Math.max(1, zoom)
  return { sx: Math.min(Math.max(0, sx), w - size), sy: Math.min(Math.max(0, sy), h - size), size }
}

export async function resizeToAvatar(file: File, crop?: Crop): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Bitte eine Bilddatei wählen.")
  const bitmap = await createImageBitmap(file)
  try {
    const { sx, sy, size } = crop ?? squareCrop(bitmap.width, bitmap.height)
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden.")
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85))
    if (!blob || blob.type !== "image/webp") throw new Error("Dieser Browser kann das Bild nicht umwandeln.")
    if (blob.size > AVATAR_MAX_BYTES) throw new Error("Das Bild ist zu groß.")
    return blob
  } finally {
    bitmap.close()
  }
}

const avatarRef = (employeeId: string) => (storage ? ref(storage, `avatars/${employeeId}.webp`) : null)

export async function uploadAvatar(employeeId: string, blob: Blob): Promise<void> {
  const r = avatarRef(employeeId)
  if (!r || !firestore) throw new Error("Cloud-Speicherung ist nicht eingerichtet.")
  await uploadBytes(r, blob, { contentType: "image/webp" })
  await updateDoc(doc(firestore, "employees", employeeId), { avatarVersion: Date.now() })
}

export async function removeAvatar(employeeId: string): Promise<void> {
  const r = avatarRef(employeeId)
  if (!r || !firestore) throw new Error("Cloud-Speicherung ist nicht eingerichtet.")
  await updateDoc(doc(firestore, "employees", employeeId), { avatarVersion: deleteField() })
  await deleteObject(r).catch(() => { /* Datei war schon weg */ })
}

const urlCache = new Map<string, Promise<string>>()

/** Download-URL des Bildes; je Mitarbeiter und Version nur eine Abfrage (die Version ändert sich bei jedem Upload). */
export function avatarUrl(employeeId: string, version: number): Promise<string> {
  const key = `${employeeId}:${version}`
  let p = urlCache.get(key)
  if (!p) {
    const r = avatarRef(employeeId)
    p = r ? getDownloadURL(r) : Promise.reject(new Error("Kein Speicher"))
    p.catch(() => urlCache.delete(key))
    urlCache.set(key, p)
  }
  return p
}
