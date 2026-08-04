// Vermittlernummern bei Partnergesellschaften — gleiche Such-/Filter-Logik
// wie partnerCompanies.ts / partnerDiscounts.ts (siehe PartnerGesellschaften.tsx
// / PartnerRabatte.tsx), nur mit Vermittler-/Beraternummern statt Kontaktpersonen
// bzw. Rabattsätzen als Inhalt. Siehe Partner.tsx / PartnerVermittlernummern.tsx.
import type { PartnerSparte } from "./partnerCompanies"

export interface VermittlernummerLine {
  label: string
  value: string
  note?: string
}

export interface VermittlernummerSection {
  title?: string
  lines: VermittlernummerLine[]
}

export interface PartnerVermittlernummer {
  id: string
  name: string
  initials: string
  legalName?: string
  badge: string
  sparten: PartnerSparte[]
  sections: VermittlernummerSection[]
  notes?: string[]
}

/** Vorberechneter Suchindex pro Gesellschaft, analog companyHaystack() /
 * discountHaystack() in partnerCompanies.ts / partnerDiscounts.ts. */
export function vermittlernummerHaystack(c: PartnerVermittlernummer): { text: string; digits: string } {
  const parts = [
    c.name, c.legalName ?? "", c.badge,
    ...c.sections.flatMap((s) => [
      s.title ?? "",
      ...s.lines.flatMap((l) => [l.label, l.value, l.note ?? ""]),
    ]),
    ...(c.notes ?? []),
  ]
  const text = parts.join(" ").toLowerCase()
  const digits = text.replace(/[^\d]/g, "")
  return { text, digits }
}

export const PARTNER_VERMITTLERNUMMERN: PartnerVermittlernummer[] = [
  {
    id: "allcura", name: "ALLCURA", initials: "AC",
    legalName: "Allcura Versicherung AG · Hamburg",
    badge: "Sach", sparten: ["sach"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "848" }] }],
  },
  {
    id: "allianz", name: "ALLIANZ", initials: "AL",
    legalName: "Allianz Elementar Versicherung AG · Hietzinger Kai 101–105, 1130 Wien",
    badge: "Vollsortiment", sparten: ["leben", "sach", "rechtsschutz", "kranken"],
    sections: [
      {
        title: "Sach",
        lines: [
          { label: "Einmalige AP", value: "7543323" },
          { label: "Laufende Provision", value: "1244382" },
        ],
      },
      {
        title: "Ablebensversicherung",
        lines: [
          { label: "FLV einmalige AP", value: "0611086" },
          { label: "FLV laufend", value: "0199134" },
          { label: "Risikoablebensv.", value: "9104331" },
        ],
      },
    ],
  },
  {
    id: "arag", name: "ARAG", initials: "AR",
    legalName: "ARAG Österreich allg. Rechtsschutzversicherung AG · Favoritenstraße 36, 1041 Wien",
    badge: "Rechtsschutz", sparten: ["rechtsschutz"],
    sections: [
      {
        lines: [
          { label: "Einmalige AP", value: "E7710327" },
          { label: "Laufende Provision", value: "E7709931" },
        ],
      },
    ],
  },
  {
    id: "continentale", name: "Continentale", initials: "CO",
    legalName: "Continentale Assekuranz Service GmbH · Fichtengasse 2a, 1010 Wien",
    badge: "Leben / Sach", sparten: ["leben", "sach"],
    sections: [
      {
        lines: [
          { label: "Einmalige AP", value: "520/8586" },
          { label: "Laufende Provision", value: "520/9350" },
        ],
      },
    ],
  },
  {
    id: "corum", name: "Corum", initials: "CR",
    legalName: "Corum · Fleischmarkt 1/6/12, 1010 Wien",
    badge: "Immobilienfonds", sparten: ["sonstige"],
    sections: [{ lines: [{ label: "Beraternummer", value: "4127" }] }],
  },
  {
    id: "golden-gates", name: "Golden Gates Austria", initials: "GG",
    legalName: "Golden Gates Austria · 5020 Salzburg",
    badge: "Leben / Vorsorge", sparten: ["leben"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "GG06335" }] }],
  },
  {
    id: "generali", name: "Generali", initials: "GE",
    legalName: "Generali Versicherung AG · Landskrongasse 1–3, 1010 Wien",
    badge: "Vollsortiment", sparten: ["sach", "leben", "rechtsschutz"],
    sections: [
      {
        lines: [
          { label: "Einmalig", value: "4/86422-2" },
          { label: "Laufend", value: "4/86423-5" },
        ],
      },
    ],
  },
  {
    id: "mylife", name: "My Life (Gothaer)", initials: "ML",
    legalName: "My Life Lebensversicherung AG · Herzberger Landstraße 25, 37085 Göttingen",
    badge: "Leben / BU", sparten: ["leben"],
    sections: [
      {
        lines: [
          { label: "FINOVA einmalig", value: "832-3390" },
          { label: "FINOVA laufend", value: "832-3392" },
        ],
      },
    ],
  },
  {
    id: "grawe", name: "Grawe", initials: "GR",
    legalName: "Grawe Wechselseitige Versicherung AG · Herrengasse 18–20, 8010 Graz",
    badge: "Vollsortiment", sparten: ["sach", "leben", "kranken"],
    sections: [
      {
        lines: [
          { label: "Einmalig", value: "00 33436" },
          { label: "Laufend", value: "00 33437" },
        ],
      },
    ],
  },
  {
    id: "donau", name: "Donau Brokerline", initials: "DO",
    legalName: "Donau Versicherung · Friedenstr. 11, 5033 Salzburg",
    badge: "Vollsortiment", sparten: ["sach", "leben", "rechtsschutz"],
    sections: [
      {
        lines: [
          { label: "Einmalige AP", value: "R 99573 WJ" },
          { label: "Laufende Provision", value: "R99181W4" },
        ],
      },
    ],
  },
  {
    id: "dialog", name: "Dialog Lebensversicherung", initials: "DI",
    legalName: "Dialog Lebensversicherung AG · Halderstraße 29, 86150 Augsburg",
    badge: "Leben / BU", sparten: ["leben"],
    sections: [
      {
        lines: [
          { label: "Einmalige AP FINOVA (RV)", value: "45/7637" },
          { label: "Laufende Provision (RV)", value: "74/7391" },
        ],
      },
    ],
  },
  {
    id: "ergo-das", name: "ERGO / DAS", initials: "ER",
    legalName: "ERGO Center · Modecenterstraße 17, 1110 Wien",
    badge: "Vollsortiment", sparten: ["rechtsschutz", "sach", "kranken"],
    sections: [
      {
        title: "Rechtsschutz",
        lines: [
          { label: "Einmalig AP", value: "7384700" },
          { label: "Laufende AP", value: "7381600" },
        ],
      },
      {
        title: "KFZ / UV / Zahn",
        lines: [
          { label: "Laufende AP (KFZ EH/HH)", value: "1807329" },
          { label: "Einmalig (UV und Zahnversicherung)", value: "1807327" },
        ],
      },
    ],
  },
  {
    id: "muki", name: "MUKI", initials: "MU",
    legalName: "Muki Versicherung · Winterstraße 10, 4820 Bad Ischl",
    badge: "Kranken / KFZ", sparten: ["kranken", "sach"],
    sections: [
      {
        lines: [
          { label: "Finova – laufende Provision (nur UV)", value: "7031241", note: "KV nur einmalig" },
        ],
      },
    ],
  },
  {
    id: "merkur-vers", name: "Merkur Versicherung", initials: "MV",
    legalName: "Merkur Versicherung · Innsbrucker Bundesstraße 67, 5020 Salzburg",
    badge: "Kranken / Unfall", sparten: ["kranken", "sach"],
    sections: [{ lines: [{ label: "Einmalige AP", value: "25602" }] }],
  },
  {
    id: "helvetia", name: "Helvetia", initials: "HV",
    legalName: "Helvetia Versicherungen AG · Gürtelturmplatz 1, 8020 Graz",
    badge: "Vollsortiment", sparten: ["sach", "leben"],
    sections: [
      {
        lines: [
          { label: "Einmalige AP + Fondsparplan", value: "14382" },
          { label: "Laufende Provision", value: "32772" },
        ],
      },
    ],
  },
  {
    id: "hannoversche", name: "Hannoversche", initials: "HA",
    legalName: "Hannoversche Lebensversicherung AG · VHV-Platz 1, 30177 Hannover",
    badge: "Leben", sparten: ["leben"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "VL106081-001" }] }],
  },
  {
    id: "vav", name: "VAV Versicherung", initials: "VA",
    legalName: "VAV Versicherungs-AG · Münzgasse 6, 1030 Wien",
    badge: "Sach / KFZ", sparten: ["sach"],
    sections: [
      {
        lines: [
          { label: "Einmalig", value: "52689" },
          { label: "Laufend", value: "52356" },
        ],
      },
    ],
  },
  {
    id: "uniqa", name: "UNIQA", initials: "UN",
    legalName: "UNIQA Österreich Versicherungen AG · Annenstraße 36–38, 8020 Graz",
    badge: "Vollsortiment", sparten: ["sach", "leben", "kranken", "rechtsschutz"],
    sections: [
      {
        lines: [
          { label: "FIN – Einmalprämie", value: "248578" },
          { label: "FIN – laufende Prämie (FLV, UV, Sachvers.)", value: "248579" },
          { label: "Einzel KV bis 45 Jahre", value: "249456" },
          { label: "Einzel KV ab 45 Jahre", value: "249457" },
          { label: "KV Gruppe", value: "249458" },
        ],
      },
    ],
  },
  {
    id: "src", name: "SRC – Special Risk Consortium", initials: "SR",
    legalName: "SRC Special Risk Consortium GmbH · Belfortstraße 15, 50668 Köln",
    badge: "Sportversicherung", sparten: ["sach"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "A-5-1007" }] }],
  },
  {
    id: "s-bausparkasse", name: "s Wohnfinanzierung / S-Bausparkasse", initials: "SB",
    legalName: "s Wohnfinanzierung Beratungs GmbH · Bundesstraße 110, 5020 Salzburg",
    badge: "Bausparen", sparten: ["sonstige"],
    sections: [{ lines: [{ label: "Finova", value: "051784" }] }],
  },
  {
    id: "ruv", name: "R+V Allgemeine Versicherung", initials: "RV",
    legalName: "R+V Allgemeine Versicherung AG · Wilhelmstraße 68, 1120 Wien",
    badge: "Vollsortiment", sparten: ["sach", "leben"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "808/135996" }] }],
  },
  {
    id: "roland", name: "Roland Rechtsschutz", initials: "RO",
    legalName: "Roland Rechtsschutz · Mariannengasse 14, 1090 Wien",
    badge: "Rechtsschutz", sparten: ["rechtsschutz"],
    sections: [{ lines: [{ label: "Finova", value: "802487" }] }],
  },
  {
    id: "passportcard", name: "PassportCard", initials: "PC",
    legalName: "PassportCard · Caffamacherreihe 8–10, 20355 Hamburg",
    badge: "Auslandsversicherung", sparten: ["kranken", "sonstige"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "42683" }] }],
  },
  {
    id: "oebv", name: "ÖBV", initials: "ÖB",
    legalName: "ÖBV Landesdirektion Steiermark · Karlauer Gürtel 1, 8020 Graz",
    badge: "Leben / Sach", sparten: ["leben", "sach"],
    sections: [{ lines: [{ label: "Einmalig / laufend", value: "11408" }] }],
  },
  {
    id: "merkur-leben", name: "Merkur Lebensversicherung", initials: "ML",
    legalName: "Merkur Lebensversicherung AG · Flachgasse 30, 1150 Wien",
    badge: "Leben / BU", sparten: ["leben"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "00/10570/000" }] }],
  },
  {
    id: "wiener-staedtische", name: "Wiener Städtische", initials: "WS",
    legalName: "Wiener Städtische Versicherung AG · Brockmanngasse 32, 8010 Graz (LD Steiermark)",
    badge: "Vollsortiment", sparten: ["sach", "leben", "rechtsschutz"],
    sections: [
      {
        lines: [
          { label: "Vermittlernummer", value: "397464 S 7" },
          { label: "Laufende Provision (nur UV, SV)", value: "345943L3" },
        ],
      },
    ],
  },
  {
    id: "wiener-verein", name: "Wiener Verein", initials: "WV",
    legalName: "Wiener Verein – Bestattungsvorsorge · Brockmanngasse 32/1 OG, 8010 Graz",
    badge: "Bestattungsvorsorge", sparten: ["sonstige"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "99984" }] }],
  },
  {
    id: "wunderlich", name: "Wunderlich – Financial Consulting", initials: "WU",
    badge: "Sonstige", sparten: ["sonstige"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "5331" }] }],
  },
  {
    id: "wuestenrot", name: "Wüstenrot", initials: "WÜ",
    legalName: "Wüstenrot Versicherungs-AG · Mariahilferplatz 5, 8020 Graz",
    badge: "Sach / Bausparen", sparten: ["sach", "sonstige"],
    sections: [{ lines: [{ label: "Vermittlernummer", value: "2001283-7 FINOVA GmbH" }] }],
  },
  {
    id: "wwk", name: "WWK", initials: "WK",
    legalName: "WWK Lebensversicherung a. G. · Hegelgasse 21, 1010 Wien",
    badge: "Leben", sparten: ["leben"],
    sections: [
      {
        lines: [
          { label: "Vermittlernummer 1", value: "Q935/3061" },
          { label: "Vermittlernummer 2", value: "Q9353060" },
        ],
      },
    ],
  },
  {
    id: "zuerich", name: "Zürich Versicherung", initials: "ZÜ",
    legalName: "Zürich Versicherung AG · Karolingerstr. 3a, 5020 Salzburg",
    badge: "Vollsortiment", sparten: ["sach", "leben", "rechtsschutz"],
    sections: [
      {
        lines: [
          { label: "Einmalige AP (alle Sparten)", value: "7929935" },
          { label: "Laufende Provision (alle Sparten)", value: "7933584" },
        ],
      },
    ],
  },
]
