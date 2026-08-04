// Ansprechpersonen bei Partnergesellschaften — funktional äquivalent zur
// separaten Vorlage "Partnergesellschaften.html" (Suche + Sparten-Filter +
// Karten-Grid), optisch an das Dashboard-Theme angepasst statt eigenem
// Finova-Header. Daten aus partnerCompanies.ts.
import { useMemo, useState } from "react"
import { Mail, Phone, Search, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  companyHaystack, PARTNER_COMPANIES, telHref,
  type PartnerCompany, type PartnerContact, type PartnerSparte,
} from "@/lib/data/partnerCompanies"

const SPARTEN: { id: PartnerSparte | "all"; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "leben", label: "Leben / Vorsorge" },
  { id: "sach", label: "Sach / KFZ" },
  { id: "kranken", label: "Kranken" },
  { id: "rechtsschutz", label: "Rechtsschutz" },
  { id: "sonstige", label: "Sonstige" },
]

const COMPANIES_WITH_HAYSTACK = PARTNER_COMPANIES.map((c) => ({ company: c, haystack: companyHaystack(c) }))

function ContactBlock({ contact }: { contact: PartnerContact }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-bold text-foreground">{contact.name}</div>
      {contact.role && <div className="text-[11px] text-muted-foreground">{contact.role}</div>}
      {contact.phones?.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[13px]">
          {p.kind === "mobil"
            ? <Smartphone className="size-3.5 shrink-0 text-[var(--teal)]" />
            : <Phone className="size-3.5 shrink-0 text-[var(--teal)]" />}
          <a href={`tel:${telHref(p.label)}`} className="font-semibold text-[var(--teal)] hover:text-[var(--mint-2)]">
            {p.label}
          </a>
          {p.note && <span className="text-[11px] text-muted-foreground">{p.note}</span>}
        </div>
      ))}
      {contact.emails?.map((e) => (
        <div key={e} className="flex items-center gap-1.5 text-xs">
          <Mail className="size-3.5 shrink-0 text-muted-foreground" />
          <a href={`mailto:${e}`} className="text-muted-foreground hover:text-[var(--teal)]">{e}</a>
        </div>
      ))}
    </div>
  )
}

function CompanyCard({ company }: { company: PartnerCompany }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3 border-b-2 border-[var(--mint)] bg-gradient-to-br from-[var(--navy)] to-[var(--teal)] px-4 py-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--mint)]/35 bg-[var(--mint)]/15 text-base font-extrabold text-[var(--mint)]">
          {company.initials}
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-extrabold leading-tight text-white">{company.name}</h3>
          <div className="mt-0.5 text-[11px] leading-snug text-white/55">{company.legalName}</div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-md bg-[var(--mint)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--navy)]">
          {company.badge}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-4 py-4">
        <div className="text-xs leading-relaxed text-muted-foreground">{company.description}</div>
        <div className="flex flex-col gap-2">
          {company.contacts.map((contact, i) => (
            <div key={i} className="flex flex-col gap-2">
              {i > 0 && <div className="h-px bg-border" />}
              <ContactBlock contact={contact} />
            </div>
          ))}
        </div>
        {company.notes && company.notes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {company.notes.map((n) => (
              <span key={n} className="rounded bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--teal)]">
                {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function PartnerGesellschaften() {
  const [query, setQuery] = useState("")
  const [sparte, setSparte] = useState<PartnerSparte | "all">("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const qDigits = q.replace(/[^\d]/g, "")
    return COMPANIES_WITH_HAYSTACK.filter(({ company, haystack }) => {
      const matchesSparte = sparte === "all" || company.sparten.includes(sparte)
      const matchesQuery = !q || haystack.text.includes(q) || (qDigits.length > 0 && haystack.digits.includes(qDigits))
      return matchesSparte && matchesQuery
    }).map(({ company }) => company)
  }, [query, sparte])

  const total = PARTNER_COMPANIES.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-60 max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Partner, Ansprechpartner oder Telefonnummer suchen …"
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length === total ? `${total} Partner` : `${filtered.length} von ${total} Partnern`}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Sparte:</span>
        {SPARTEN.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSparte(s.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              sparte === s.id
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-16 text-center text-muted-foreground">
          <Search className="size-8" />
          <p className="text-sm">Keine Ergebnisse für <strong>&quot;{query}&quot;</strong></p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => <CompanyCard key={c.id} company={c} />)}
        </div>
      )}
    </div>
  )
}
