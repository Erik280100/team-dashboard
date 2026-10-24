// Siegertreppchen (Dashboard-Kachel): Platz 1–3 nach Einheiten, als eigene Superhelden-Figuren (Inline-SVG) mit dem
// Profilbild der Person als Kopf (Initialen ohne Bild). Aufstellung wie beim echten Podest: 2 – 1 – 3.
import { Avatar } from "@/components/Avatar"
import { cn } from "@/lib/utils"

export interface PodiumEntry {
  name: string
  /** Einheiten */
  value: number
}

type AvatarInfo = { id: string; version: number }

// Anzug / Umhang / Podest je Platz: Gold, Silber, Bronze.
const TIERS = [
  { suit: "#F2C14E", dark: "#B8860B", block: "bg-yellow-500 text-black", height: 88 },
  { suit: "#D5DBE0", dark: "#8A96A0", block: "bg-neutral-300 text-black", height: 66 },
  { suit: "#CD7F32", dark: "#8B4F1D", block: "bg-amber-700 text-white", height: 50 },
] as const

function Hero({ rank, name, avatar }: { rank: 0 | 1 | 2; name: string; avatar?: AvatarInfo }) {
  const { suit, dark } = TIERS[rank]
  return (
    <div className="relative h-[100px] w-[84px]" aria-hidden="true">
      <svg viewBox="0 0 84 100" className="absolute inset-0 size-full">
        {/* Umhang */}
        <path d="M28 44 L56 44 L72 94 L12 94 Z" fill={dark} opacity="0.9" />
        {/* Beine + Stiefel */}
        <rect x="31" y="70" width="10" height="22" rx="3" fill={suit} />
        <rect x="43" y="70" width="10" height="22" rx="3" fill={suit} />
        <rect x="30" y="86" width="12" height="8" rx="3" fill={dark} />
        <rect x="42" y="86" width="12" height="8" rx="3" fill={dark} />
        {/* Arme: Platz 1 reckt die Faust nach oben */}
        <path d="M30 46 L18 62 L22 66 L32 54 Z" fill={suit} />
        {rank === 0 ? (
          <>
            <path d="M54 46 L68 28 L72 32 L56 52 Z" fill={suit} />
            <circle cx="70" cy="28" r="5" fill={dark} />
          </>
        ) : (
          <>
            <path d="M54 46 L66 62 L62 66 L52 54 Z" fill={suit} />
            <circle cx="64" cy="66" r="4" fill={dark} />
          </>
        )}
        <circle cx="20" cy="65" r="4" fill={dark} />
        {/* Oberkörper, Gürtel, Emblem */}
        <rect x="30" y="42" width="24" height="30" rx="6" fill={suit} />
        <rect x="30" y="66" width="24" height="5" fill={dark} />
        <path d="M42 50 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7 Z" fill={dark} />
      </svg>
      {/* Kopf: Profilbild */}
      <Avatar
        name={name}
        avatar={avatar}
        zoomable
        className="absolute left-1/2 top-0 size-10 -translate-x-1/2 border-2 text-xs text-white"
        style={{ borderColor: suit }}
      />
    </div>
  )
}

export function Siegertreppchen({
  entries, avatars, formatValue,
}: {
  /** Absteigend nach Einheiten sortiert; es zählen die ersten drei. */
  entries: PodiumEntry[]
  avatars?: Record<string, AvatarInfo>
  formatValue: (n: number) => string
}) {
  const top = entries.slice(0, 3)
  if (top.length === 0) {
    return <div className="py-8 text-center text-sm text-white/50">Noch keine Einheiten gebucht.</div>
  }
  const label = top.map((e, i) => `Platz ${i + 1}: ${e.name}, ${formatValue(e.value)} Einheiten`).join("; ")
  // Podest-Reihenfolge: Platz 2 links, Platz 1 Mitte, Platz 3 rechts.
  const slots = [1, 0, 2] as const
  return (
    <div role="img" aria-label={label} className="flex items-end justify-center gap-2">
      {slots.map((i) => {
        const entry = top[i]
        if (!entry) return <div key={i} className="flex-1" />
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center">
            <Hero rank={i} name={entry.name} avatar={avatars?.[entry.name]} />
            <div className="mt-1 w-full truncate text-center text-xs font-medium text-white/90">{entry.name}</div>
            <div className="mb-1 text-[11px] tabular-nums text-white/60">{formatValue(entry.value)} EH</div>
            <div
              className={cn("flex w-full items-start justify-center rounded-t-md pt-1.5 text-2xl font-extrabold", TIERS[i].block)}
              style={{ height: TIERS[i].height }}
            >
              {i + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}
