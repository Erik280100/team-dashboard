// Zuschneide-Dialog fürs Profilbild: Bild im quadratischen Rahmen verschieben und zoomen, erst "Übernehmen" speichert.
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cropAt, type Crop } from "@/lib/avatar"

const VIEW = 280

export function AvatarCropDialog({ file, onCancel, onConfirm }: {
  file: File | null
  onCancel: () => void
  onConfirm: (crop: Crop) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ sx: 0, sy: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!file) return
    const u = URL.createObjectURL(file)
    setUrl(u)
    setDims(null)
    setZoom(1)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const crop = dims ? cropAt(dims.w, dims.h, zoom, pos.sx, pos.sy) : null
  const scale = crop ? VIEW / crop.size : 1

  function onLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const w = e.currentTarget.naturalWidth
    const h = e.currentTarget.naturalHeight
    const c = cropAt(w, h, 1, (w - Math.min(w, h)) / 2, (h - Math.min(w, h)) / 2)
    setDims({ w, h })
    setPos({ sx: c.sx, sy: c.sy })
  }

  function onZoom(next: number) {
    if (!dims || !crop) return
    // um die Mitte des aktuellen Ausschnitts zoomen
    const size = Math.min(dims.w, dims.h) / next
    const c = cropAt(dims.w, dims.h, next, crop.sx + crop.size / 2 - size / 2, crop.sy + crop.size / 2 - size / 2)
    setZoom(next)
    setPos({ sx: c.sx, sy: c.sy })
  }

  function onMove(e: React.PointerEvent) {
    if (!drag.current || !dims || !crop) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    const c = cropAt(dims.w, dims.h, zoom, crop.sx - dx / scale, crop.sy - dy / scale)
    setPos({ sx: c.sx, sy: c.sy })
  }

  return (
    <Dialog open={!!file} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bildausschnitt wählen</DialogTitle>
          <DialogDescription>Bild mit der Maus oder dem Finger verschieben, mit dem Regler vergrößern.</DialogDescription>
        </DialogHeader>
        <div
          className="relative mx-auto touch-none cursor-grab overflow-hidden rounded-full border bg-muted active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY } }}
          onPointerMove={onMove}
          onPointerUp={() => { drag.current = null }}
          onPointerCancel={() => { drag.current = null }}
        >
          {url && (
            <img
              src={url}
              alt=""
              draggable={false}
              onLoad={onLoad}
              className="absolute top-0 left-0 max-w-none select-none"
              style={dims && crop
                ? { width: dims.w * scale, height: dims.h * scale, transform: `translate(${-crop.sx * scale}px, ${-crop.sy * scale}px)` }
                : { visibility: "hidden" }}
            />
          )}
        </div>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          disabled={!dims}
          onChange={(e) => onZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="w-full"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
          <Button disabled={!crop} onClick={() => crop && onConfirm(crop)}>Übernehmen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
