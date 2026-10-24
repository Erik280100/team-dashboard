// Profilbild ändern (Einstellungen): jeder ändert nur sein eigenes Bild; angezeigt wird es auf der Mitarbeiterseite.
import { useRef, useState } from "react"
import { Avatar } from "@/components/Avatar"
import { AvatarCropDialog } from "@/components/sections/AvatarCropDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { removeAvatar, resizeToAvatar, uploadAvatar } from "@/lib/avatar"

export function ProfilbildCard({ employeeId, name, version }: { employeeId: string; name: string; version?: number }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : "Das hat nicht geklappt.") }
    finally { setBusy(false) }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Profilbild</h2>
        <div className="flex items-center gap-4">
          <Avatar name={name} avatar={version ? { id: employeeId, version } : undefined} className="size-20 text-xl" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              {version ? "Bild ändern" : "Bild wählen"}
            </Button>
            {version && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => removeAvatar(employeeId))}>
                Entfernen
              </Button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) setPicked(file)
          }}
        />
        <AvatarCropDialog
          file={picked}
          onCancel={() => setPicked(null)}
          onConfirm={(crop) => {
            const file = picked
            setPicked(null)
            if (file) run(async () => uploadAvatar(employeeId, await resizeToAvatar(file, crop)))
          }}
        />
        <p className="text-xs text-muted-foreground">
          Den Ausschnitt wählst du vor dem Speichern selbst; das Bild wird quadratisch verkleinert. Alle im Team sehen es auf der Mitarbeiterseite.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
