// Unterlagen-Checkliste für Kreditfälle — 1:1 aus
// public/docs/Finanzierungscheckliste_finovacredit.pdf (Finova Credit) übernommen.
// Keine Legacy-Entsprechung: neue Sektion "Finanzierungen".

export type Beschaeftigung = "unselbststaendig" | "selbststaendig"

export interface DocItem {
  id: string
  label: string
  /** Klammer-Zusatz aus dem PDF, z. B. "bei nicht EU Bürgern". */
  hint?: string
}

export interface DocGroup {
  id: string
  title: string
  /** Gruppe gilt nur für diese Beschäftigungsart (fehlt = immer relevant). */
  only?: Beschaeftigung
  items: DocItem[]
}

export const CHECKLIST: DocGroup[] = [
  {
    id: "allgemein",
    title: "Allgemein",
    items: [
      { id: "ausweis", label: "Ausweiskopien" },
      { id: "antrag", label: "Finanzierungsantrag", hint: "FCCM" },
      { id: "kontoauszuege", label: "Kontoauszüge der letzten 6 Monate" },
      { id: "meldezettel", label: "Meldezettel" },
      { id: "aufenthaltstitel", label: "Aufenthaltstitel", hint: "bei nicht EU Bürgern" },
    ],
  },
  {
    id: "unselbststaendig",
    title: "Unselbstständig",
    only: "unselbststaendig",
    items: [
      { id: "lohnzettel", label: "Lohnzettel der letzten 6 Monate" },
      { id: "karenzgeld", label: "Karenzgeldbescheid" },
      {
        id: "svauszug",
        label: "Sozialversicherungsdatenauszug mit Beitragsgrundlagen",
        hint: "bei nicht österr. Staatsbürgerschaft",
      },
    ],
  },
  {
    id: "selbststaendig",
    title: "Selbstständig",
    only: "selbststaendig",
    items: [
      { id: "bilanzen", label: "Bilanzen bzw. Einnahmen-Ausgaben-Rechnung der letzten 3 Jahre" },
      { id: "est", label: "ESt-Erklärungen inkl. ESt-Bescheide der letzten 3 Jahre" },
      { id: "saldenliste", label: "Saldenliste des aktuellen Jahres" },
      { id: "bestaetigung", label: "Bestätigung Sozialversicherung und Finanzamt" },
    ],
  },
  {
    id: "verbindlichkeiten",
    title: "Verbindlichkeiten",
    items: [
      { id: "kreditvertraege", label: "Kreditverträge" },
      { id: "restsalden", label: "Restsaldenbestätigungen", hint: "inklusive Datum und IBAN" },
    ],
  },
  {
    id: "eigenmittel",
    title: "Eigenmittel",
    items: [
      {
        id: "eigenmittel",
        label: "Eigenmittelnachweise",
        hint: "wie Sparbücher, Kontoauszüge, Lebensversicherungen, Depotauszüge etc.",
      },
    ],
  },
  {
    id: "liegenschaft",
    title: "Liegenschaft (Haus, Wohnung, etc.)",
    items: [
      { id: "plaene", label: "Pläne aller Objekte" },
      { id: "grundbuch", label: "Grundbuchauszug" },
      { id: "fotos", label: "Fotos von allen Objekten", hint: "Außen- und Innenfotos" },
      { id: "expose", label: "Exposé" },
      { id: "kaufvertrag", label: "Kaufvertrag", hint: "mindestens Entwurf" },
      { id: "baukosten", label: "Baukostenaufstellung", hint: "Kostenvoranschläge und Angebote" },
      { id: "bewertung", label: "Liegenschaftsbewertung" },
      { id: "energieausweis", label: "Energieausweis" },
    ],
  },
]

/** Gruppen, die für eine Beschäftigungsart relevant sind (Allgemein/Verbindlichkeiten/
 * Eigenmittel/Liegenschaft immer, Unselbstständig/Selbstständig schließen sich aus). */
export function relevantGroups(b: Beschaeftigung): DocGroup[] {
  return CHECKLIST.filter((g) => !g.only || g.only === b)
}

/** Item-IDs, die für eine Beschäftigungsart zählen — Basis für den Fortschrittsbalken. */
export function relevantItemIds(b: Beschaeftigung): string[] {
  return relevantGroups(b).flatMap((g) => g.items.map((i) => i.id))
}
