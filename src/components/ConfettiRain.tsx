// Konfettiregen: Vollbild-Canvas ohne Klick-Abfang, läuft ~4 Sekunden pro Auslösung. Keine Bibliothek.
// Weitere Buchungen während eines laufenden Regens legen frisches Konfetti nach und verlängern ihn.
import { useEffect, useRef, useState } from "react"
import { CELEBRATE_EVENT } from "@/lib/celebrate"

const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#facc15"]
const DURATION_MS = 4200
const FADE_MS = 800
const COUNT = 180
const MAX_PIECES = 900

interface Piece { x: number; y: number; vx: number; vy: number; size: number; rot: number; vr: number; color: string }

function makePieces(width: number): Piece[] {
  return Array.from({ length: COUNT }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * 300,
    vx: (Math.random() - 0.5) * 3,
    vy: 2 + Math.random() * 4,
    size: 6 + Math.random() * 8,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }))
}

export function ConfettiRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const piecesRef = useRef<Piece[]>([])
  const endRef = useRef(0)
  const [who, setWho] = useState<string | null>(null)

  useEffect(() => {
    function frame(now: number) {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (!canvas || !ctx) { rafRef.current = null; return }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const left = endRef.current - now
      if (left <= 0) {
        piecesRef.current = []
        rafRef.current = null
        setWho(null)
        return
      }
      ctx.globalAlpha = left < FADE_MS ? left / FADE_MS : 1
      // Stücke, die unten raus sind, fallen weg — so bleibt der Regen bei vielen Buchungen leicht.
      piecesRef.current = piecesRef.current.filter((p) => p.y < canvas.height + 30)
      for (const p of piecesRef.current) {
        p.x += p.vx + Math.sin(p.y / 40) * 0.6
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      rafRef.current = requestAnimationFrame(frame)
    }

    function start(e: Event) {
      const canvas = canvasRef.current
      if (!canvas) return
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
      setWho((e as CustomEvent<{ name?: string }>).detail?.name ?? null)
      if (rafRef.current === null) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        piecesRef.current = []
      }
      piecesRef.current = [...piecesRef.current, ...makePieces(canvas.width)].slice(-MAX_PIECES)
      endRef.current = performance.now() + DURATION_MS
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(frame)
    }

    window.addEventListener(CELEBRATE_EVENT, start)
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, start)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[100]" />
      {who && (
        <div role="status" className="pointer-events-none fixed left-1/2 top-4 z-[101] -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg">
          🎉 {who} hat Umsatz gebucht!
        </div>
      )}
    </>
  )
}
