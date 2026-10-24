// Rundes Profilbild mit Initialen als Ersatz (kein Bild hochgeladen oder noch nicht geladen).
import { useEffect, useState, type CSSProperties } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { avatarUrl } from "@/lib/avatar"
import { initials } from "@/lib/calc/format"

export function Avatar({
  name, avatar, className, style, zoomable,
}: {
  name: string
  /** Klick öffnet das Bild groß (nur sinnvoll bei fremden Bildern; ohne hochgeladenes Bild passiert nichts). */
  zoomable?: boolean
  avatar?: { id: string; version: number }
  className?: string
  style?: CSSProperties
}) {
  const [url, setUrl] = useState<string | null>(null)
  const id = avatar?.id
  const version = avatar?.version
  useEffect(() => {
    setUrl(null)
    if (!id || !version) return
    let cancelled = false
    avatarUrl(id, version).then((u) => { if (!cancelled) setUrl(u) }).catch(() => { /* Initialen bleiben */ })
    return () => { cancelled = true }
  }, [id, version])

  const [open, setOpen] = useState(false)
  const base = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-bold", className)
  const img = url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : initials(name)

  if (!zoomable || !url) return <div style={style} className={base}>{img}</div>
  return (
    <>
      <button
        type="button"
        style={style}
        className={cn(base, "cursor-zoom-in")}
        aria-label={`Profilbild von ${name} vergrößern`}
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
      >
        {img}
      </button>
      {/* Dialog liegt im Portal; Klicks darin dürfen nicht zur (klickbaren) Tabellenzeile durchblubbern */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription className="sr-only">Profilbild in groß</DialogDescription>
          </DialogHeader>
          <img src={url} alt={`Profilbild von ${name}`} className="mx-auto aspect-square w-full max-w-sm rounded-lg object-cover" />
        </DialogContent>
      </Dialog>
    </>
  )
}
