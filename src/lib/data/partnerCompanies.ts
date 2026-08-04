// Partnergesellschaften & Ansprechpersonen — inhaltlich übernommen aus der
// separaten Vorlage "Partnergesellschaften.html" (37 Gesellschaften), die
// bisher nicht im Dashboard verlinkt war. Ergänzt die Kachel-Liste in
// partners.ts (PARTNER_PORTALS = reine Login-Links) um die dazugehörigen
// Kontaktpersonen. Siehe Partner.tsx / PartnerGesellschaften.tsx.

export type PartnerSparte = "leben" | "sach" | "kranken" | "rechtsschutz" | "sonstige"

export interface PartnerPhone {
  /** Steuert das Icon (Festnetz vs. Mobil) in der Karte. */
  kind: "tel" | "mobil"
  /** Anzeigetext genau wie in der Quelle, z.B. "0676/878211861". */
  label: string
  /** Zusatz rechts vom Link, z.B. "Lebensversicherung", "Schaden". */
  note?: string
}

export interface PartnerContact {
  name: string
  role?: string
  phones?: PartnerPhone[]
  emails?: string[]
}

export interface PartnerCompany {
  id: string
  name: string
  initials: string
  legalName: string
  badge: string
  sparten: PartnerSparte[]
  description: string
  contacts: PartnerContact[]
  /** Vermittler-/Flotten-/Agenturnummern u.ä. */
  notes?: string[]
}

/** "0664 96 27 337" / "00049 511 9565-599" / "+43 5 04487-240" → gültiger
 * tel:-Link. Die href-Werte der Quell-Vorlage waren größtenteils fehlerhaft
 * (abgeschnitten/verdoppelt), daher wird der Link aus dem Anzeigetext
 * abgeleitet statt übernommen. */
export function telHref(label: string): string {
  const digitsAndPlus = label.replace(/[^\d+]/g, "")
  if (digitsAndPlus.startsWith("00")) return `+${digitsAndPlus.slice(2)}`
  if (digitsAndPlus.startsWith("+")) return digitsAndPlus
  if (digitsAndPlus.startsWith("0")) return `+43${digitsAndPlus.slice(1)}`
  return digitsAndPlus
}

/** Vorberechneter Suchindex pro Gesellschaft: normalisierter Volltext plus
 * eine reine Ziffernvariante, damit z.B. "878211861" auch "0676/878211861"
 * trifft. */
export function companyHaystack(c: PartnerCompany): { text: string; digits: string } {
  const parts = [
    c.name, c.legalName, c.badge, c.description,
    ...c.contacts.flatMap((ct) => [
      ct.name, ct.role ?? "",
      ...(ct.phones ?? []).flatMap((p) => [p.label, p.note ?? ""]),
      ...(ct.emails ?? []),
    ]),
    ...(c.notes ?? []),
  ]
  const text = parts.join(" ").toLowerCase()
  const digits = text.replace(/[^\d]/g, "")
  return { text, digits }
}

export const PARTNER_COMPANIES: PartnerCompany[] = [
  {
    id: "4money", name: "4money Financial Services", initials: "4M",
    legalName: "4money Financial Services GmbH · Einspinnergasse 1, 8010 Graz",
    badge: "Finanzierung", sparten: ["sonstige"],
    description: "Finanzdienstleistungen und Kreditvermittlung.",
    contacts: [
      {
        name: "Markus Kohlmeier",
        phones: [{ kind: "tel", label: "069918828478" }],
        emails: ["markus.kohlmeier@4money.at"],
      },
    ],
  },
  {
    id: "allcura", name: "ALLCURA", initials: "AC",
    legalName: "Allcura Versicherung AG · Hamburg",
    badge: "Sach", sparten: ["sach"],
    description: "Allgemeine Sachversicherungen.",
    contacts: [
      {
        name: "Christian Moser",
        phones: [
          { kind: "tel", label: "004940 226 337 – 854" },
          { kind: "mobil", label: "0043 664 310 76 70" },
        ],
      },
    ],
  },
  {
    id: "allianz", name: "ALLIANZ", initials: "AL",
    legalName: "Allianz Elementar Versicherung AG · Hietzinger Kai 101–105, 1130 Wien",
    badge: "Vollsortiment", sparten: ["leben", "sach", "rechtsschutz", "kranken"],
    description: "Vollsortiment: KFZ, Eigenheim, Haushalt, Rechtsschutz, Lebensversicherung, Gesundheitsversicherung, Gewerbe und Unfall.",
    contacts: [
      {
        name: "Nicole Tomaszewski", role: "Key Account Managerin",
        phones: [{ kind: "mobil", label: "0676/878211861" }],
        emails: ["nicole.tomaszewski@allianz.at"],
      },
      {
        name: "Gerald Wellenschütz", role: "Ansprechpartner betriebliche Altersvorsorge (BAV)",
        phones: [{ kind: "mobil", label: "0676/878260934" }],
        emails: ["gerald.wellenschuetz@allianz.at"],
      },
      {
        name: "Gunther Kos", role: "Firmenverträge",
        phones: [{ kind: "mobil", label: "0676/878267081" }],
        emails: ["firmengeschaeft@allianz.at"],
      },
      {
        name: "Serviceleitungen",
        phones: [
          { kind: "tel", label: "0590099006", note: "Allgemein" },
          { kind: "tel", label: "059009549", note: "Lebensversicherung" },
          { kind: "tel", label: "0590099009", note: "Schaden" },
          { kind: "tel", label: "0800/2033300", note: "Schaden Schlüsseldienst" },
          { kind: "tel", label: "059009588", note: "Gesundheitsversicherung" },
          { kind: "tel", label: "059009581", note: "Gewerbeversicherung" },
        ],
      },
    ],
    notes: ["Flottennummer 046135"],
  },
  {
    id: "arag", name: "ARAG", initials: "AR",
    legalName: "ARAG Österreich allg. Rechtsschutzversicherung AG · Favoritenstraße 36, 1041 Wien",
    badge: "Rechtsschutz", sparten: ["rechtsschutz"],
    description: "Rechtsschutzversicherungen für Privat und Gewerbe.",
    contacts: [
      {
        name: "Danijel Radovanovic", role: "Vertriebsrepräsentant Region Süd",
        phones: [{ kind: "mobil", label: "0664 96 27 337" }],
        emails: ["danijel.radovanovic@arag.at"],
      },
      {
        name: "Katja Grünstetter", role: "Backoffice / Vertriebsinnendienst",
        phones: [{ kind: "tel", label: "01 53102 1428" }],
        emails: ["katja.gruenstetter@arag.at"],
      },
      {
        name: "Allgemeine Anfragen",
        phones: [{ kind: "tel", label: "01531021600" }],
        emails: ["info@arag.at"],
      },
    ],
  },
  {
    id: "carglass", name: "Carglass", initials: "CG",
    legalName: "Carglass Austria GmbH · Haidingergasse 2, 1030 Wien",
    badge: "Partnerservice", sparten: ["sonstige"],
    description: "Glasreparatur und -austausch, Kooperationspartner für KFZ-Schäden.",
    contacts: [
      {
        name: "Kurt Siegl", role: "Regional Sales Manager",
        phones: [{ kind: "mobil", label: "0664 88283325" }],
        emails: ["k.siegl@carglass.at"],
      },
    ],
  },
  {
    id: "continentale", name: "Continentale", initials: "CO",
    legalName: "Continentale Assekuranz Service GmbH · Fichtengasse 2a, 1010 Wien",
    badge: "Leben / Sach", sparten: ["leben", "sach"],
    description: "Lebens- und Sachversicherungen.",
    contacts: [
      {
        name: "Mario Jahnig", role: "Direktionsbevollmächtigter",
        phones: [{ kind: "mobil", label: "0664 10 40 275" }],
        emails: ["mario-jahnig@continentale.at"],
      },
      {
        name: "Stefan Jungwirth", role: "Backoffice",
        phones: [{ kind: "tel", label: "015123352" }],
        emails: ["stefan-jungwirth@continentale.at"],
      },
    ],
  },
  {
    id: "corum", name: "Corum", initials: "CR",
    legalName: "Corum · Fleischmarkt 1/6/12, 1010 Wien",
    badge: "Immobilienfonds", sparten: ["sonstige"],
    description: "Immobilienfonds (Corum Origin, Corum XL) für Partnervertrieb.",
    contacts: [
      {
        name: "Martin Prandl", role: "Key Account Manager",
        phones: [{ kind: "mobil", label: "+43 664 3210 268" }],
        emails: ["martin.prandl@corum-am.com"],
      },
    ],
    notes: ["Beraternummer: 4127"],
  },
  {
    id: "ergo-das", name: "ERGO / DAS", initials: "ER",
    legalName: "ERGO Center · Modecenterstraße 17, 1110 Wien",
    badge: "Vollsortiment", sparten: ["rechtsschutz", "sach", "kranken"],
    description: "Rechtsschutz (DAS), KFZ, Zahnversicherung, Rechtsberatung. Makler ServiceLine: makler@ergo-versicherung.at",
    contacts: [
      {
        name: "Bernd Griesbacher", role: "Ansprechpartner Rechtsschutz & GRS",
        phones: [
          { kind: "tel", label: "+43/1274444-6522" },
          { kind: "mobil", label: "0676 88327-4210" },
        ],
        emails: ["bernd.griesbacher@ergo-versicherung.at"],
      },
      {
        name: "Manuel Gassner", role: "KFZ & Zahn-Themen",
        phones: [{ kind: "mobil", label: "0664 8592463" }],
        emails: ["manuel.gassner@ergo-versicherung.at"],
      },
      {
        name: "Elisabeth Hinterleitner", role: "Vetriebszentrale Steiermark",
        phones: [{ kind: "tel", label: "+43/316/712 207 – 4262" }],
        emails: ["elisabeth.hinterleitner@ergo-versicherung.at"],
      },
      {
        name: "Makler ServiceLine / Schaden / Rechtsberatung",
        phones: [
          { kind: "tel", label: "+43 127444-6440", note: "Schaden / ServiceLine" },
          { kind: "tel", label: "0800 224422", note: "Rechtsberatung & Inkasso" },
        ],
      },
    ],
  },
  {
    id: "euroherc", name: "Euroherc", initials: "EH",
    legalName: "Euroherc Versicherung · Maklerportal: provos.euroherc.at",
    badge: "KFZ / Sach", sparten: ["sach"],
    description: "KFZ- und Sachversicherungen.",
    contacts: [
      {
        name: "Rene Tretnik", role: "Maklerbetreuer",
        phones: [{ kind: "mobil", label: "0664-888-106-52" }],
        emails: ["rene.tretnik@euroherc.at"],
      },
      {
        name: "Allgemeine Anfragen Graz",
        emails: ["makler.graz@euroherc.at"],
      },
    ],
  },
  {
    id: "dialog", name: "Dialog Lebensversicherung", initials: "DI",
    legalName: "Dialog Lebensversicherung AG · Halderstraße 29, 86150 Augsburg",
    badge: "Leben / BU", sparten: ["leben"],
    description: "Lebensversicherungen, Berufsunfähigkeit. Serviceteam Österreich: 0800 20 40 74.",
    contacts: [
      {
        name: "Michael Heinrich", role: "Vertriebspartnerbetreuer",
        phones: [{ kind: "mobil", label: "0664 4539700" }],
        emails: ["Michael.heinrich@dialog-leben.at"],
      },
      {
        name: "Serviceteam Österreich",
        phones: [{ kind: "tel", label: "0800 20 40 74" }],
        emails: ["team-AUT@dialog-leben.at"],
      },
    ],
  },
  {
    id: "donau", name: "Donau Brokerline", initials: "DO",
    legalName: "Donau Versicherung · Friedenstr. 11, 5033 Salzburg",
    badge: "Vollsortiment", sparten: ["sach", "leben", "rechtsschutz"],
    description: "Sach-, Leben- und Rechtsschutzversicherungen. Maklerportal: donauversicherung.at/maklerportal",
    contacts: [
      {
        name: "Iris Bründlinger", role: "Regionale Vertriebsmanagerin",
        phones: [{ kind: "tel", label: "050 330-78006" }],
        emails: ["i.bruendlinger@donauversicherung.at"],
      },
      {
        name: "Andreas Kornpointner", role: "Lebensversicherung",
        phones: [{ kind: "tel", label: "0664/60139-72108" }],
        emails: ["a.kornpointner@donauversicherung.at"],
      },
      {
        name: "Thomas Kurz", role: "Allgemeine Anfragen Graz",
        phones: [{ kind: "tel", label: "Tel: 05033073805" }],
        emails: ["t.kurz@donauversicherung.at"],
      },
      {
        name: "Backoffice Salzburg",
        emails: ["makler.sbg@donauversicherung.at", "schaden@donauversicherung.at"],
      },
    ],
  },
  {
    id: "froots", name: "Froots", initials: "FR",
    legalName: "Asset Management by froots GmbH · Rauhensteingasse 12, 1010 Wien",
    badge: "Asset Mgmt", sparten: ["sonstige"],
    description: "ETF-basiertes Vermögensmanagement. Partnerportal: froots.io/finova",
    contacts: [
      {
        name: "Victor Gatterer-Serrano",
        phones: [
          { kind: "tel", label: "01343170921" },
          { kind: "mobil", label: "0664 450 23 96" },
        ],
        emails: ["vgs@froots.io"],
      },
    ],
  },
  {
    id: "generali", name: "Generali", initials: "GE",
    legalName: "Generali Versicherung AG · Landskrongasse 1–3, 1010 Wien",
    badge: "Vollsortiment", sparten: ["sach", "leben", "rechtsschutz"],
    description: "Vollsortiment Sach-, Leben-, Kranken- und KFZ-Versicherungen.",
    contacts: [
      {
        name: "Jakob Kostmann", role: "Maklerbetreuer",
        phones: [{ kind: "mobil", label: "+43 676 8258 2517" }],
        emails: ["jakob.kostmann@generali.com"],
      },
      {
        name: "Daniel Schmidt", role: "Maklerbetreuer",
        phones: [
          { kind: "mobil", label: "+43 (664) 780 036 85" },
          { kind: "tel", label: "+43 316/782-652" },
        ],
        emails: ["daniel.schmidt@uniqa.at"],
      },
      {
        name: "ALLE Anfragen",
        emails: ["partnerservice.sued@uniqa.at"],
      },
    ],
  },
  {
    id: "golden-gates", name: "Golden Gates Austria", initials: "GG",
    legalName: "Golden Gates Austria · 5020 Salzburg",
    badge: "Leben / Vorsorge", sparten: ["leben"],
    description: "Personenversicherungen und betriebliche Altersvorsorge.",
    contacts: [
      {
        name: "Uwe Erbschwendtner", role: "Geschäftsführer",
        phones: [{ kind: "mobil", label: "+43 664 456 55 15" }],
        emails: ["u.erbschwendtner@goldengates.at"],
      },
      {
        name: "Bernhard Oberascher", role: "Verkaufsleiter",
        phones: [{ kind: "mobil", label: "+43 664 244 60 94" }],
        emails: ["b.oberascher@goldengates.sale"],
      },
      {
        name: "Manfred Melzer", role: "Regionalleiter",
        phones: [{ kind: "mobil", label: "+43 664 531 91 37" }],
        emails: ["m.melzer@goldengates.sale"],
      },
    ],
  },
  {
    id: "grawe", name: "Grawe", initials: "GR",
    legalName: "Grawe Wechselseitige Versicherung AG · Herrengasse 18–20, 8010 Graz",
    badge: "Vollsortiment", sparten: ["sach", "leben", "kranken"],
    description: "Vollsortiment: Leben, Sach, Kranken.",
    contacts: [
      {
        name: "Lisa Tödtling", role: "Vertriebsdirektion Österreich",
        phones: [{ kind: "tel", label: "316 80 376842" }],
        emails: ["Lisa.Toedtling@grawe.at"],
      },
      {
        name: "Matthias Kargl", role: "Maklerbetreuer",
        phones: [
          { kind: "tel", label: "Tel: 0316 80 34 22 41" },
          { kind: "mobil", label: "Mobil: 0664 450 23 96" },
        ],
        emails: ["matthias.kargl@merkur.at"],
      },
    ],
  },
  {
    id: "hansemerkur", name: "HanseMerkur", initials: "HM",
    legalName: "HanseMerkur Reiseversicherung AG · Dannebergplatz 19/9, 1030 Wien",
    badge: "Reiseversicherung", sparten: ["sonstige"],
    description: "Reiseversicherungen (alle Standard-Touristik-Produkte inkl. RK364/Young Travel).",
    contacts: [
      {
        name: "Nadine Pfiel",
        phones: [{ kind: "tel", label: "01/710 48 400" }],
      },
    ],
    notes: ["Agenturnummer: 4775391"],
  },
  {
    id: "hannoversche", name: "Hannoversche", initials: "HA",
    legalName: "Hannoversche Lebensversicherung AG · VHV-Platz 1, 30177 Hannover",
    badge: "Leben", sparten: ["leben"],
    description: "Risikolebens- und Berufsunfähigkeitsversicherungen.",
    contacts: [
      {
        name: "Anträge & Servicehotline",
        phones: [
          { kind: "tel", label: "00049 511 9565-599", note: "Anträge" },
          { kind: "tel", label: "00049 511 9565-598", note: "Vertrag & Leistung" },
        ],
      },
    ],
    notes: ["Vermittlernr.: VL106081-001"],
  },
  {
    id: "helvetia", name: "Helvetia", initials: "HV",
    legalName: "Helvetia Versicherungen AG · Gürtelturmplatz 1, 8020 Graz",
    badge: "Vollsortiment", sparten: ["sach", "leben"],
    description: "KFZ, Eigenheim/Haushalt, Lebensversicherung. Eingeloggt über Partnerportal mit Sonderrabatten.",
    contacts: [
      {
        name: "Jörg Scheriau", role: "Verkaufsleiter Sachversicherungen",
        phones: [
          { kind: "tel", label: "Tel: +43 (0) 50 222 5545" },
          { kind: "mobil", label: "0664 80 47 45 545" },
        ],
        emails: ["joerg.scheriau@helvetia.at"],
      },
      {
        name: "Kevin Fraiß", role: "Verkaufsleiter Personenversicherung",
        phones: [{ kind: "tel", label: "Tel: 050 222 5767" }],
        emails: ["kevin.fraiss@helvetia.at"],
      },
      {
        name: "Daniel Kolitsch / Kerstin Hackl", role: "Administratives (Interventionen, Auskünfte)",
        phones: [
          { kind: "tel", label: "Tel: 050 222 5553", note: "Sachvers." },
          { kind: "tel", label: "Tel: 050 222 5551", note: "Personenvers." },
        ],
      },
    ],
  },
  {
    id: "infinco", name: "Infinco", initials: "IN",
    legalName: "Infinco GmbH · Fallmerayerstraße 12, 6020 Innsbruck",
    badge: "Finanzierung", sparten: ["sonstige"],
    description: "Finanzierungslösungen und Kreditvermittlung.",
    contacts: [
      {
        name: "Alexander Kirchknopf",
        phones: [{ kind: "tel", label: "Tel.: +43-1-3618056-12" }],
        emails: ["a.kirchknopf@infinco.com"],
      },
    ],
  },
  {
    id: "merkur-vers", name: "Merkur Versicherung", initials: "MV",
    legalName: "Merkur Versicherung · Innsbrucker Bundesstraße 67, 5020 Salzburg",
    badge: "Kranken / Unfall", sparten: ["kranken", "sach"],
    description: "Kranken-, Unfall- und Pflegeversicherungen.",
    contacts: [
      {
        name: "Matthias Kargl", role: "Maklerbetreuer",
        phones: [
          { kind: "tel", label: "Tel: 0316 80 34 22 41" },
          { kind: "mobil", label: "0664 450 23 96" },
        ],
        emails: ["matthias.kargl@merkur.at"],
      },
      {
        name: "Harald Schelch", role: "Leitung Partnervertrieb Ost",
        phones: [
          { kind: "tel", label: "Tel: 0316 80 34-27 07" },
          { kind: "mobil", label: "0664 96 78 017" },
        ],
        emails: ["harald.schelch@merkur.at"],
      },
      {
        name: "Wolfgang Ganhör", role: "Partnerbetreuung Innendienst",
        phones: [{ kind: "mobil", label: "Tel.: 0664/42 15 924" }],
        emails: ["wolfgang.ganhoer@merkur.at"],
      },
    ],
  },
  {
    id: "merkur-leben", name: "Merkur Lebensversicherung", initials: "ML",
    legalName: "Merkur Lebensversicherung AG · Flachgasse 30, 1150 Wien",
    badge: "Leben / BU", sparten: ["leben"],
    description: "Lebens-, Berufsunfähigkeits- und Rentenversicherungen.",
    contacts: [
      {
        name: "Christian Blaskovic", role: "Key Account Manager / Direktion Großverbindungen",
        phones: [
          { kind: "tel", label: "Tel.: +43 5 04487-240" },
          { kind: "mobil", label: "Mobil: +43 664 888 545 99" },
        ],
        emails: ["christian.blaskovic@merkur-leben.at"],
      },
      {
        name: "Katrin Rebernig", role: "Vertriebsassistentin Großverbindungen",
        phones: [{ kind: "tel", label: "Tel.: +43 5 04487-244" }],
        emails: ["katrin.rebernig@merkur-leben.at"],
      },
      {
        name: "Daniela Leitner", role: "Vertriebsassistentin Großverbindungen",
        phones: [{ kind: "tel", label: "Tel: +43 5 04 487-242" }],
        emails: ["daniela.leitner@merkur-leben.at"],
      },
    ],
  },
  {
    id: "muki", name: "MUKI", initials: "MU",
    legalName: "Muki Versicherung · Winterstraße 10, 4820 Bad Ischl",
    badge: "Kranken / KFZ", sparten: ["kranken", "sach"],
    description: "Kranken-, Unfall-, KFZ- und Elementarversicherungen.",
    contacts: [
      {
        name: "Michael Brunner",
        phones: [
          { kind: "tel", label: "Tel. 0 50 665 1541" },
          { kind: "mobil", label: "Mobil. 664 6212672" },
        ],
        emails: ["michael.brunner@muki.com"],
      },
      {
        name: "Abteilungstelefone",
        phones: [
          { kind: "tel", label: "05 0665-5100", note: "Kranken Vertrag" },
          { kind: "tel", label: "05 0665-5150", note: "Unfall Vertrag" },
          { kind: "tel", label: "05 0665-5300", note: "KFZ Vertrag" },
          { kind: "tel", label: "05 0665-5600", note: "Vertriebspartner-Service" },
        ],
      },
    ],
  },
  {
    id: "mylife", name: "My Life (Gothaer)", initials: "ML",
    legalName: "My Life Lebensversicherung AG · Herzberger Landstraße 25, 37085 Göttingen",
    badge: "Leben / BU", sparten: ["leben"],
    description: "Risikolebens- und Berufsunfähigkeitsversicherungen (Gothaer Gruppe).",
    contacts: [
      {
        name: "Kundenservice",
        phones: [
          { kind: "tel", label: "Tel: +49 551 9976 780" },
          { kind: "tel", label: "Tel: +49 551 9976 778", note: "Service 2" },
        ],
        emails: ["vertriebsservice@mylife-leben.de"],
      },
    ],
  },
  {
    id: "oebv", name: "ÖBV", initials: "ÖB",
    legalName: "ÖBV Landesdirektion Steiermark · Karlauer Gürtel 1, 8020 Graz",
    badge: "Leben / Sach", sparten: ["leben", "sach"],
    description: "Lebens-, Unfall- und Sachversicherungen für den öffentlichen Dienst.",
    contacts: [
      {
        name: "Stefan Wenter Bakk.phil.", role: "Maklerbetreuer",
        phones: [
          { kind: "tel", label: "059808-4115" },
          { kind: "mobil", label: "06641226111" },
        ],
        emails: ["stefan.wenter@oebv.com"],
      },
      {
        name: "Marina Faschingbauer", role: "Backoffice",
        phones: [{ kind: "tel", label: "059 808-2395" }],
        emails: ["marina.faschingbauer@oebv.com"],
      },
    ],
  },
  {
    id: "passportcard", name: "PassportCard", initials: "PC",
    legalName: "PassportCard · Caffamacherreihe 8–10, 20355 Hamburg",
    badge: "Auslandsversicherung", sparten: ["kranken", "sonstige"],
    description: "Auslandskrankenversicherung mit digitaler Bezahlkarte.",
    contacts: [
      {
        name: "Harald Gruber", role: "Chief Commercial Officer",
        phones: [{ kind: "mobil", label: "Mobil: + 49 157 855 18 343" }],
        emails: ["harald.gruber@passportcard.de"],
      },
    ],
    notes: ["Vermittlernr.: 42683"],
  },
  {
    id: "roland", name: "Roland Rechtsschutz", initials: "RO",
    legalName: "Roland Rechtsschutz · Mariannengasse 14, 1090 Wien",
    badge: "Rechtsschutz", sparten: ["rechtsschutz"],
    description: "Rechtsschutzversicherungen für Privat und Gewerbe.",
    contacts: [
      {
        name: "Mag. Markus Grutschnig",
        phones: [
          { kind: "mobil", label: "Mobil: +43664/1317896" },
          { kind: "tel", label: "Tel. +43 1 7187733-60" },
        ],
        emails: ["Markus.Grutschnig@roland-rechtsschutz.at"],
      },
    ],
    notes: ["Vermittlernr.: 802487 Finova"],
  },
  {
    id: "ruv", name: "R+V Allgemeine Versicherung", initials: "RV",
    legalName: "R+V Allgemeine Versicherung AG · Wilhelmstraße 68, 1120 Wien",
    badge: "Vollsortiment", sparten: ["sach", "leben"],
    description: "Sach-, Leben- und Tierversicherungen (Pferdeversicherung: pferd-ruv.at).",
    contacts: [
      {
        name: "Karin Pokorny", role: "Maklerverwaltung",
        phones: [{ kind: "tel", label: "+43 (0) 1 810 5333 560" }],
        emails: ["Karin.Pokorny@ruv.at"],
      },
    ],
  },
  {
    id: "s-bausparkasse", name: "s Wohnfinanzierung / S-Bausparkasse", initials: "SB",
    legalName: "s Wohnfinanzierung Beratungs GmbH · Bundesstraße 110, 5020 Salzburg",
    badge: "Bausparen", sparten: ["sonstige"],
    description: "Bauspar- und Wohnfinanzierungsprodukte.",
    contacts: [
      {
        name: "Gerhard Kantner", role: "Gebietsbetreuer",
        phones: [{ kind: "mobil", label: "Mobil: 0664 818 34 39" }],
        emails: ["gerhard.kantner@sbausparkasse.at"],
      },
    ],
  },
  {
    id: "src", name: "SRC – Special Risk Consortium", initials: "SR",
    legalName: "SRC Special Risk Consortium GmbH · Belfortstraße 15, 50668 Köln",
    badge: "Sportversicherung", sparten: ["sach"],
    description: "Spezialist für Sportversicherungen und besondere Risikoabsicherungen.",
    contacts: [
      {
        name: "Gericke Stefan",
        phones: [{ kind: "tel", label: "0049 (0) 221 / 91 409 40" }],
        emails: ["stefan.gericke@srcmail.de"],
      },
    ],
  },
  {
    id: "servo", name: "Servo GmbH", initials: "SE",
    legalName: "Servo GmbH · Jakob-Haringer-Straße 8, 5020 Salzburg",
    badge: "Dienstleistung", sparten: ["sonstige"],
    description: "Unternehmensberatung und Versicherungsdienstleistungen.",
    contacts: [
      {
        name: "Rudolf Hinterleitner", role: "Unternehmensberater – Versicherungsagent",
        phones: [
          { kind: "tel", label: "+ 43 (0)5 0171017" },
          { kind: "mobil", label: "Mobil: +43 660 50 66 007" },
        ],
        emails: ["r.hinterleitner@myservo.at"],
      },
    ],
  },
  {
    id: "uniqa", name: "UNIQA", initials: "UN",
    legalName: "UNIQA Österreich Versicherungen AG · Annenstraße 36–38, 8020 Graz",
    badge: "Vollsortiment", sparten: ["sach", "leben", "kranken", "rechtsschutz"],
    description: "Vollsortiment: KFZ, Eigenheim, Kranken, Leben, Rechtsschutz. KFZ-Gutachten: 0810/955165.",
    contacts: [
      {
        name: "Daniel Schmidt", role: "Maklerbetreuer",
        phones: [
          { kind: "mobil", label: "+43 (664) 780 036 85" },
          { kind: "tel", label: "+43 316/782-652" },
        ],
        emails: ["daniel.schmidt@uniqa.at"],
      },
      {
        name: "Service & Schaden",
        phones: [
          { kind: "tel", label: "017 1607 811", note: "Service" },
          { kind: "tel", label: "0810/955165", note: "KFZ Gutachtenbeauftragung" },
        ],
        emails: ["partnerservice.sued@uniqa.at", "schaden@uniqa.at"],
      },
    ],
  },
  {
    id: "vav", name: "VAV Versicherung", initials: "VA",
    legalName: "VAV Versicherungs-AG · Münzgasse 6, 1030 Wien",
    badge: "Sach / KFZ", sparten: ["sach"],
    description: "KFZ-, Sach- und Haftpflichtversicherungen für Privat und Gewerbe.",
    contacts: [
      {
        name: "Michael Schlegl", role: "Regionalleiter",
        phones: [{ kind: "mobil", label: "Tel.: 0664/8115367" }],
        emails: ["michael.schlegl@vav.at"],
      },
      {
        name: "Maklerbetreuung Innendienst",
        phones: [{ kind: "tel", label: "01 716 07-811" }],
        emails: ["serviceteam3@vav.at", "schaden@vav.at"],
      },
    ],
  },
  {
    id: "wiener-staedtische", name: "Wiener Städtische", initials: "WS",
    legalName: "Wiener Städtische Versicherung AG · Brockmanngasse 32, 8010 Graz (LD Steiermark)",
    badge: "Vollsortiment", sparten: ["sach", "leben", "rechtsschutz"],
    description: "Vollsortiment: KFZ, Eigenheim, Haushalt, Rechtsschutz, Unfall, Gewerbe, Lebensversicherung.",
    contacts: [
      {
        name: "Mario Manhart", role: "Maklerservice",
        phones: [
          { kind: "tel", label: "Tel: 050 350 43215" },
          { kind: "mobil", label: "Mobil: 0664 32 25 831" },
        ],
        emails: ["m.manhart@wienerstaedtische.at"],
      },
      {
        name: "Yvonne Mauko", role: "Verkaufsunterstützung / Konsumentengeschäft",
        phones: [{ kind: "tel", label: "Tel: + 43 50 350 43 389" }],
      },
      {
        name: "Ines Wintschnig", role: "Backoffice / Partnervertrieb",
        phones: [{ kind: "tel", label: "Tel: + 43 50 350 43 009" }],
      },
      {
        name: "Richard Neumann", role: "Firmengeschäft (Gewerbegeschäft)",
        phones: [{ kind: "tel", label: "Tel: +43 50 350 43 370" }],
        emails: ["gewerbe-stmk@wienerstaedtische.at"],
      },
      {
        name: "Schaden / Bestand",
        emails: [
          "Scu.leistung@wienerstaedtische.at",
          "bestandsauskunft@wienerstaedtische.at",
          "partner-stmk@wienerstaedtische.at",
        ],
      },
    ],
  },
  {
    id: "wiener-verein", name: "Wiener Verein", initials: "WV",
    legalName: "Wiener Verein – Bestattungsvorsorge · Brockmanngasse 32/1 OG, 8010 Graz",
    badge: "Bestattungsvorsorge", sparten: ["sonstige"],
    description: "Bestattungsvorsorge und Sterbegeldversicherung.",
    contacts: [
      {
        name: "Jörg Pfingstner", role: "Leiter Landesorganisation Steiermark & Burgenland",
        phones: [
          { kind: "tel", label: "050 350 69213" },
          { kind: "mobil", label: "Mobil: 0664 60139 69213" },
        ],
        emails: ["j.pfingstner@wienerverein.at"],
      },
    ],
    notes: ["Vermittlernr.: 99984"],
  },
  {
    id: "wuestenrot", name: "Wüstenrot", initials: "WÜ",
    legalName: "Wüstenrot Versicherungs-AG · Mariahilferplatz 5, 8020 Graz",
    badge: "Sach / Bausparen", sparten: ["sach", "sonstige"],
    description: "KFZ-, Sach- und Personenversicherungen sowie Bausparen und Finanzierungen.",
    contacts: [
      {
        name: "Mag. Gerlinde Galler-Fischill", role: "Maklerbetreuerin Vermittler Service Stmk",
        phones: [{ kind: "mobil", label: "Mobil: 0664 / 103 46 34" }],
        emails: ["gerlinde.galler@wuestenrot.at"],
      },
      {
        name: "Margit Egger", role: "Backoffice",
        phones: [{ kind: "tel", label: "057070 / 250-62" }],
        emails: ["MBT5@wuestenrot.at"],
      },
    ],
    notes: ["Vermittlernr.: 2001283-7 FINOVA GmbH"],
  },
  {
    id: "wwk", name: "WWK", initials: "WK",
    legalName: "WWK Lebensversicherung a. G. · Hegelgasse 21, 1010 Wien",
    badge: "Leben", sparten: ["leben"],
    description: "Fondgebundene Lebens- und Rentenversicherungen.",
    contacts: [
      {
        name: "Stefan Otto", role: "Vertriebsdirektion Österreich",
        phones: [{ kind: "tel", label: "01/8121656" }],
        emails: ["STEFAN.OTTO@wwk.at"],
      },
    ],
  },
  {
    id: "zuerich", name: "Zürich Versicherung", initials: "ZÜ",
    legalName: "Zürich Versicherung AG · Karolingerstr. 3a, 5020 Salzburg",
    badge: "Vollsortiment", sparten: ["sach", "leben", "rechtsschutz"],
    description: "Vollsortiment: Sach, KFZ, Leben, Gewerbe, Rechtsschutz.",
    contacts: [
      {
        name: "Johannes Schinwald", role: "Maklerbetreung",
        phones: [{ kind: "mobil", label: "Mobil: 0664 83 76 945" }],
        emails: ["johannes.schinwald@at.zurich.com"],
      },
      {
        name: "Christian Seiringer", role: "Spezialist Gewerbeversicherung",
        phones: [{ kind: "mobil", label: "Mobil: +43 664 88115377" }],
        emails: ["christian.seiringer@at.zurich.com"],
      },
      {
        name: "Nicole Stöger", role: "Maklerbetreung Sachversicherung",
        phones: [{ kind: "mobil", label: "Mobil: +43 664 88115013" }],
      },
      {
        name: "Maklerservice",
        phones: [{ kind: "tel", label: "+43 1 50125-1305" }],
        emails: ["maklerservice.west@at.zurich.com", "leistung@at.zurich.com"],
      },
    ],
  },
]
