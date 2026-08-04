// Partnerportale-Kacheln — Äquivalent zu initPartnerPortals() aus legacy/index.html:4786–4795.
// Verschoben aus Partner.tsx (siehe dort), unverändert.
import { PARTNER_PORTALS } from "@/lib/data/partners"

export function PartnerPortale() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {PARTNER_PORTALS.map((p) => (
        <a
          key={p.name}
          href={p.url}
          target="_blank"
          rel="noopener"
          className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center transition-colors hover:bg-muted"
        >
          <span className="flex size-10 items-center justify-center text-2xl">
            {p.icon ? <img src={p.icon} alt="" className="size-10 object-contain" /> : "🏢"}
          </span>
          <span className="text-xs font-medium leading-tight">{p.name}</span>
        </a>
      ))}
    </div>
  )
}
