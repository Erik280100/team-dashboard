// Rabattmöglichkeiten bei Partnergesellschaften — gleiche Such-/Filter-Logik
// wie partnerCompanies.ts (siehe PartnerGesellschaften.tsx), nur mit
// Rabattsätzen statt Kontaktpersonen als Inhalt. Siehe Partner.tsx /
// PartnerRabatte.tsx.
import type { PartnerSparte } from "./partnerCompanies"

export interface DiscountLine {
  label: string
  value: string
  note?: string
}

export interface DiscountSection {
  title?: string
  lines: DiscountLine[]
  conditions?: string[]
}

export interface PartnerDiscount {
  id: string
  name: string
  initials: string
  legalName?: string
  badge: string
  sparten: PartnerSparte[]
  sections: DiscountSection[]
  notes?: string[]
}

/** Vorberechneter Suchindex pro Gesellschaft, analog companyHaystack() in
 * partnerCompanies.ts. */
export function discountHaystack(c: PartnerDiscount): { text: string; digits: string } {
  const parts = [
    c.name, c.legalName ?? "", c.badge,
    ...c.sections.flatMap((s) => [
      s.title ?? "",
      ...s.lines.flatMap((l) => [l.label, l.value, l.note ?? ""]),
      ...(s.conditions ?? []),
    ]),
    ...(c.notes ?? []),
  ]
  const text = parts.join(" ").toLowerCase()
  const digits = text.replace(/[^\d]/g, "")
  return { text, digits }
}

export const PARTNER_DISCOUNTS: PartnerDiscount[] = [
  {
    id: "arag", name: "ARAG", initials: "AR",
    legalName: "ARAG Österreich allg. Rechtsschutzversicherung AG",
    badge: "Rechtsschutz", sparten: ["rechtsschutz"],
    sections: [
      {
        lines: [
          { label: "Individualrabatt", value: "5%" },
          { label: "Vermittlerrabatt", value: "20%" },
        ],
      },
    ],
  },
  {
    id: "allianz", name: "ALLIANZ", initials: "AL",
    legalName: "Allianz Elementar Versicherung AG",
    badge: "Vollsortiment", sparten: ["sach", "rechtsschutz", "sonstige"],
    sections: [
      {
        title: "KFZ",
        lines: [
          { label: "KFZ-Haftpflicht", value: "20%" },
          { label: "KFZ-Teilkasko", value: "20%" },
          { label: "KFZ-Vollkasko", value: "20%" },
        ],
        conditions: [
          "Gültigkeit nur für den Privatbereich, nicht für juristische Fahrzeuge",
          "Gilt nur für PKW, Kombi, LKW bis 2t Nutzlast",
          "Gilt nicht für den Wientarif (Kennzeichen Wien)",
        ],
      },
      {
        title: "Eigenheim & Haushalt",
        lines: [
          { label: "Neugeschäft / Konvertierung", value: "max. 20%" },
          { label: "Multirisk", value: "30%" },
        ],
        conditions: ["Tarifprämien bleiben unverändert"],
      },
      {
        title: "Sonstige Sparten",
        lines: [
          { label: "Motorräder & Moped Sonderrabatt", value: "max. 15%" },
          { label: "Rechtsschutzversicherung", value: "20%" },
          { label: "Unfallversicherung", value: "20%" },
        ],
        conditions: [
          "Bei Nutzung dieser Flottennummer ist eine digitale Überleitung nicht mehr verpflichtend",
          "In der Unfallversicherung werden keine Dauerrabattrückforderungen mehr übernommen",
        ],
      },
    ],
    notes: ["Flottennummer 046135"],
  },
  {
    id: "donau", name: "Donau Brokerline", initials: "DO",
    legalName: "Donau Versicherung",
    badge: "Vollsortiment", sparten: ["sach", "rechtsschutz", "sonstige"],
    sections: [
      {
        title: "Neugeschäft (Privatkunden)",
        lines: [
          { label: "EH, EH/HH, HH, RS, Unfall", value: "max. 30%" },
        ],
        conditions: ["Ausnahmen müssen vorab mit der Fachabteilung abgestimmt werden"],
      },
      {
        title: "Konvertierung bestehender Verträge",
        lines: [
          { label: "UV – nicht unfallgefährdete Berufe", value: "bis zu 40%" },
          { label: "UV – unfallgefährdete Berufe", value: "0%" },
          { label: "EH", value: "37%" },
          { label: "EH solo", value: "30%" },
          { label: "HH solo", value: "55%" },
          { label: "EHV-HHV-Bündel", value: "45%" },
          { label: "KFZ-einspurig", value: "Fixprämie" },
          { label: "KFZ", value: "bis zu 37%", note: "bei int. B/M-Stufe max. 29%" },
          { label: "RS (All-Inclusive-Produkt)", value: "40%" },
        ],
        conditions: [
          "Bei 50iger Sparer (unabhängig vom Alter) auf 0er Stufe: max. 29% statt 40% Rabatt",
        ],
      },
    ],
  },
  {
    id: "helvetia", name: "Helvetia", initials: "HV",
    legalName: "Helvetia Versicherungen AG",
    badge: "Vollsortiment", sparten: ["sach"],
    sections: [
      {
        title: "KFZ",
        lines: [
          { label: "Exklusivvertriebsrabatt (auf HP und Kasko)", value: "13%" },
        ],
        conditions: ["Zusätzlich zum Basisrabatt eingebbar"],
      },
      {
        title: "HGP",
        lines: [
          { label: "Sonderrabatt", value: "20%" },
          { label: "Qualitätsrabatt", value: "17%" },
          { label: "Verkaufsleiterrabatt", value: "10%" },
        ],
      },
    ],
  },
  {
    id: "uniqa", name: "UNIQA", initials: "UN",
    legalName: "UNIQA Österreich Versicherungen AG",
    badge: "Vollsortiment", sparten: ["sach", "rechtsschutz", "sonstige"],
    sections: [
      {
        lines: [
          { label: "EH/HH", value: "26%" },
          { label: "RS", value: "26%" },
          { label: "UV", value: "20%" },
        ],
      },
    ],
  },
  {
    id: "vav", name: "VAV Versicherung", initials: "VA",
    legalName: "VAV Versicherungs-AG",
    badge: "Sach / KFZ", sparten: ["sach"],
    sections: [
      {
        lines: [
          { label: "KFZ", value: "10%", note: "nur bei Online-Überleitung" },
          { label: "HH Sonderrabatt", value: "5%" },
          { label: "EH Sonderrabatt", value: "5%" },
        ],
      },
    ],
  },
  {
    id: "zuerich", name: "Zürich Versicherung", initials: "ZÜ",
    legalName: "Zürich Versicherung AG",
    badge: "Vollsortiment", sparten: ["sach", "rechtsschutz", "sonstige"],
    sections: [
      {
        lines: [
          { label: "RS", value: "28%" },
          { label: "UV", value: "10%", note: "nicht auf Blicktarif" },
          { label: "KFZ Kasko", value: "30%" },
          { label: "KFZ HPV", value: "25%" },
          { label: "HH „stand alone“ ohne EHV", value: "20%" },
        ],
      },
      {
        title: "EHV",
        lines: [
          { label: "Feuer", value: "30%" },
          { label: "Sturm", value: "30%" },
          { label: "Leitungswasser", value: "30%" },
          { label: "Haftpflicht", value: "30%" },
          { label: "Haushalt im Bündel mit EHV", value: "30%" },
          { label: "Glaspaket", value: "20%" },
        ],
      },
    ],
  },
  {
    id: "wuestenrot", name: "Wüstenrot", initials: "WÜ",
    legalName: "Wüstenrot Versicherungs-AG",
    badge: "Sach / Bausparen", sparten: ["sach", "rechtsschutz", "sonstige"],
    sections: [
      {
        title: "Vermittlerrabatte (Feld Zusatzeingaben)",
        lines: [
          { label: "KFZ Haftpflicht (Verbands-BM-Stufe 0–7)", value: "20%" },
          { label: "KFZ Teilkasko", value: "5%" },
          { label: "KFZ Vollkasko", value: "10%" },
          { label: "HH Solo (Neu & Konvertierung)", value: "27,50%" },
          { label: "EH/HH", value: "17,50%" },
          { label: "Privat RS", value: "10%" },
          { label: "UV", value: "30%" },
        ],
        conditions: ["Bei Teilkasko und KFZ RS solo ist kein Rabatt möglich"],
      },
    ],
  },
  {
    id: "wiener-staedtische", name: "Wiener Städtische", initials: "WS",
    legalName: "Wiener Städtische Versicherung AG",
    badge: "Vollsortiment", sparten: ["sach", "rechtsschutz"],
    sections: [
      {
        lines: [
          { label: "Eigenheim", value: "bis zu 40%" },
          { label: "Haushalt", value: "bis zu 45%" },
          { label: "Privatrechtsschutz", value: "bis zu 28%" },
          { label: "KFZ PKW & LKW bis 1,5t Nutzlast (Haftpflicht & Kasko)", value: "bis zu 50%" },
          { label: "Business Class", value: "bis zu 55%" },
          { label: "Agrar-Betriebsversicherung", value: "bis zu 45%" },
          { label: "Wohnhausversicherung", value: "bis zu 59%" },
        ],
      },
    ],
  },
]
