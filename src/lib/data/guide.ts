// Guide-Inhalte — 1:1 aus legacy/index.html:4797-5021 übernommen.
export interface GuideSection {
  id: string
  title: string
  html: string
}

export const GUIDE_SECTIONS: GuideSection[] = [
  { id: 'analyse', title: 'Analyse', html: `
    <h2>Ablauf nach dem geschriebenen AT</h2>
    <ul>
      <li>Checkliste für Auskünfte ausfüllen und dem Berater schicken</li>
      <li>Berater anrufen oder Sprachnachricht schicken und vom AT erzählen</li>
    </ul>

    <h3>Erwartung nach einem geschriebenen AT</h3>
    <ul>
      <li>Welche Versicherungen er nicht haben will – und warum nicht</li>
      <li>Wie viel er sparen will</li>
      <li>Warum er sparen will – mittel- und langfristig</li>
    </ul>

    <h2>Leitfaden / Formulierungen für den AT</h2>

    <h3>Investitions-Einstieg</h3>
    <p><em>„Wär das nicht super, wenn jeder immer den Betrag zur Verfügung hat, den man aktuell gerade braucht?“</em></p>
    <ul>
      <li><b>Kurzfristig:</b> totes Geld, das sich nur ansammelt.</li>
      <li><b>Mittelfristig:</b> soll leben!</li>
    </ul>

    <h3>Liquiditätsreserve erfragen</h3>
    <p><em>„Wie viel auf welchem Konto, wie viel Polster willst du haben? Der restliche Betrag sollte ja in der Zwischenzeit optimal für deine Ziele arbeiten, oder? Welche Liquiditätsreserve wünschst du dir?“</em></p>
    <p>Der Rest, der übrig bleibt, ist sinnvoll zum Investieren – sonst ist das totes Geld.</p>

    <h3>Kinder finanziell unterstützen</h3>
    <p>Direkt fragen, ob Partnerin, Tante, Onkel etc. auch etwas wegsparen. Bei Ja:</p>
    <p><em>„Glaubst du nicht, es wäre sinnvoller, einen Weg zu finden, gemeinsam 100 € einzusparen? Freut sich das Kind zum 18. Geburtstag über 25.000–30.000 € mehr als über 10.000 €, oder?“</em></p>
    <p>Hochrechnung mitgeben und daraus eine Empfehlung für den nächsten AT ableiten.</p>

    <h3>Management Summary</h3>
    <p><em>„Laut Berechnung kommen diese Beträge raus. Wenn ich dir beim nächsten Mal in der Beratung ein Konzept mit diesen Werten mitbringe – fühlst du dich dann wohl damit, findest du das zu hoch, zu niedrig oder passend?“</em></p>
    <p>Antwort z. B.: 100 € / 200 € / 100 €</p>
    <p><em>„Ok, wenn ich dir beim nächsten Mal diese Aufteilung mitbringe – sind das dann auch die Beträge, bei denen du sagst ‚genau so würd ich mir das vorstellen‘ und genau so fühlst du dich wohl? Hab ich das richtig verstanden?“</em></p>

    <h2>Empfehlungen</h2>
    <p>Wenn wir die Leute im Netzwerk haben, ist das für die Person ein Vorteil – noch nie hat sich jemand aufgeregt, weil er Unterstützung bekommen hat.</p>
    <p><b>Typische Anlässe:</b> Hauskauf, Wohnungskauf, Wohnungsverkauf, Verlassenschaft, Scheidung.</p>

    <h2>Mitarbeiter-Empfehlungen</h2>
    <p>Gezielt nach Personen aus dem Bekanntenkreis fragen:</p>
    <ul>
      <li>Jemand, der voll auf die Ernährung schaut und voll ins Gym geht</li>
      <li>Jemand, der ein voller Taktiker ist</li>
      <li>Jemand, der voll gut mit Zahlen umgehen kann</li>
      <li>Jemand, dem du es voll vergönnen würdest – „Bei uns kann man bei 10–15 h 1.200 € verdienen“</li>
    </ul>

    <h3>Columbo (am Ende des Gesprächs)</h3>
    <p><em>„(Name), auf dich hab ich ja vergessen – wie schaut's mit dir aus? Wäre so etwas für dich generell interessant, bist du da offen dafür?“</em></p>

    <h3>Statistik</h3>
    <p>Bei 5 angesprochenen Personen fängt im Schnitt einer an – das entspricht 300 € pro Mitarbeiter.</p>
  ` },
  { id: 'credit', title: 'Finova Credit', html: `
    <h2>Nach dem AT – Nächste Schritte</h2>
    <p>FCCM anlegen, danach dem Kunden alles erklären.</p>

    <h3>Offene Klärungspunkte</h3>
    <ul>
      <li>Checkliste übergeben</li>
      <li>Gibt es einen Makler?</li>
      <li>Gibt es einen Notar?</li>
      <li>Ist der Kunde bereit, das Girokonto zu wechseln?</li>
    </ul>

    <h3>Finanzierungsgespräch</h3>
    <p>Sobald der Kunde alle Daten aufbereitet hat – macht Georg.</p>

    <h3>Unterlagen (digital, je Dokument als separates PDF)</h3>
    <ul>
      <li>Unterlagen in Drive-Ordner speichern und umbenennen</li>
      <li>Checkliste im Dashboard auf Seite <a href="https://erik280100.github.io/team-dashboard/#finanzierungen" target="_blank" rel="noopener">Finanzierungen</a> aktuell halten</li>
    </ul>

    <h3>Download</h3>
    <p><a class="btn btn-primary btn-small" href="docs/Finanzierungscheckliste_finovacredit.pdf" download>Finanzierungscheckliste herunterladen</a></p>
  ` },
  { id: 'realestate', title: 'Finova Real Estate', html: '' },
  { id: 'anlegerwohnungen', title: 'Anlegerwohnung', html: `
    <h2>Anlegerwohnung – C&amp;P</h2>
    <p>Ansprechpartner: Alex Grassl – fährt mit zu den Kundenterminen.</p>

    <h3>Vergütung</h3>
    <p>2,5 % auf die Wohnung + die Finanzierung.</p>

    <h3>Warum Anlegerwohnungen?</h3>
    <p>Eine der wenigen Möglichkeiten, wo private Leute gehebelte Investitionen tätigen können.</p>

    <h3>Einstieg</h3>
    <p>Möglich ab 15.000 € Invest – Liquidität ist dann nicht gegeben.</p>

    <h3>Objektauswahl</h3>
    <p>Welches Objekt das richtige ist, ist der Job der C&amp;P:</p>
    <ul>
      <li>Neubauprojekte</li>
      <li>Sekundärmarktprojekte (Kauf und Sanierung)</li>
      <li>Sekundärmarktprojekte von bereits verkauften Wohnungen</li>
      <li>Zurückverkaufte Wohnungen an die C&amp;P, die dann im C&amp;P-Netzwerk angeboten werden</li>
    </ul>

    <h3>Langfristige Strategie</h3>
    <p>Langfristig geht es nicht darum, eine Wohnung zu kaufen, sondern alle 1–3 Jahre die nächste Wohnung.</p>
    <p>Ab der zweiten Wohnung keine Eigenmittel mehr nötig, sondern die andere Immobilie als Sicherheit einsetzen.</p>
  ` },
  { id: 'invest', title: 'Froots', html: `
    <h2>Tipps</h2>
    <h3>Maximum ohne Vermögensberater</h3>
    <ul>
      <li>Monatlich 500 €</li>
      <li>Einmalig: 10.000 €</li>
    </ul>
    <p>Ab 250 € / Monat: Rücksprache mit Georg, bevor der Kunde angelegt wird.</p>

    <h3>Riesen Vorteil von Vermögensverwaltung</h3>
    <ul>
      <li>Reaktionszeit</li>
      <li>Vermögensverwaltung, die für dich kauft und verkauft</li>
      <li>Weniger Schwankung / mehr Sicherheit</li>
      <li>Kein Ausgabeaufschlag – also weniger Kosten</li>
      <li>Automatisches Ablaufmanagement mit Gewinnsicherungsprinzip</li>
    </ul>

    <h2>Ablauf – Kundenanmeldung</h2>
    <p>Anmeldung: E-Mail-Adresse des Kunden verwenden.</p>

    <h3>Kritische Punkte im Prozess</h3>
    <ul>
      <li>Punkt 4: „Nachhaltigkeitsneutral" anklicken</li>
      <li>Punkte 12, 13, 14 (Kenntnisse): „Verstehe ich" oder „Habe ich genutzt" auswählen</li>
    </ul>

    <h3>Portfolio</h3>
    <p>Wird automatisch durch die KI berechnet – keine manuelle Eingabe nötig.</p>

    <h3>Abschluss – 2 Möglichkeiten</h3>
    <ul>
      <li>Vertrag exportieren → Deckblatt unterschreiben mit <a href="https://www.oesterreich.gv.at/de/landingpages/pdf_signatur_services" target="_blank" rel="noopener">ID Austria</a></li>
      <li>Foto von sich + Ausweis direkt im Tool</li>
    </ul>

    <h3>Eröffnung</h3>
    <p>Innerhalb von 7 Tagen → SEPA-Setup → Abbuchung ab dem 1. des Monats.</p>

    <h2>Factsheets</h2>
    <ul>
      <li><a href="docs/factsheets/Liquity%20Plus-SRI-1.pdf" target="_blank" rel="noopener">Liquity Plus (SRI 1)</a></li>
      <li><a href="docs/factsheets/Goal-SRI-2.pdf" target="_blank" rel="noopener">Goal (SRI 2)</a></li>
      <li><a href="docs/factsheets/Peace%20of%20Mind-SRI-2.pdf" target="_blank" rel="noopener">Peace of Mind (SRI 2)</a></li>
      <li><a href="docs/factsheets/Future-SRI-3.pdf" target="_blank" rel="noopener">Future (SRI 3)</a></li>
      <li><a href="docs/factsheets/Balance-SRI-3.pdf" target="_blank" rel="noopener">Balance (SRI 3)</a></li>
      <li><a href="docs/factsheets/Dream%20Big-SRI-4.pdf" target="_blank" rel="noopener">Dream Big (SRI 4)</a></li>
      <li><a href="docs/factsheets/Global%20Equities-SRI-5.pdf" target="_blank" rel="noopener">Global Equities (SRI 5)</a></li>
    </ul>

    <h2>Beratungsprotokoll für Umsatzfreigabe</h2>
    <p><a class="btn btn-primary btn-small" href="docs/factsheets/Beratungsprotokoll_Umsatzfreigabe.pdf" download>Beratungsprotokoll herunterladen</a></p>
  ` },
  { id: 'edelmetalle', title: 'Edelmetalle', html: `
    <h2>Edelmetalle – Golden Gates</h2>
    <p>Grundprinzip: Man kauft einmalig das Recht, Gold zum Großhandelspreis zu erwerben. Das physische Gold wird in München eingelagert. Investieren per Sparplan ist möglich, Verkauf und Tausch jederzeit.</p>

    <h3>Was bringt das konkret? Ein Vergleich.</h3>
    <p>Der entscheidende Vorteil ist der Einkaufspreis pro Gramm Gold:</p>
    <table>
      <thead>
        <tr><th>Anbieter</th><th>Preis / Gramm</th></tr>
      </thead>
      <tbody>
        <tr><td>Münze Österreich (1g, Einzelkauf)</td><td>162,30 €</td></tr>
        <tr><td>Münze Österreich (50g, Großmenge)</td><td>120,55 €</td></tr>
        <tr><td>Golden Gates (Großhandelspreis)</td><td>120,52 €</td></tr>
      </tbody>
    </table>
    <p>Golden Gates bietet also denselben Preis wie ein 50g-Großeinkauf bei der Münze Österreich – aber schon ab dem ersten Gramm.</p>

    <h3>Rechenbeispiel: 100 € Sparplan über 10 Jahre</h3>
    <table>
      <thead>
        <tr><th></th><th>Münze Österreich</th><th>Golden Gates</th></tr>
      </thead>
      <tbody>
        <tr><td>Gesamt eingezahlt</td><td>12.000 €</td><td>12.000 €</td></tr>
        <tr><td>Ankaufsgebühr (12 %)</td><td>–</td><td>– 1.440 €</td></tr>
        <tr><td>Effektiv in Gold investiert</td><td>12.000 €</td><td>10.560 €</td></tr>
        <tr><td>Preis / Gramm</td><td>162,30 €</td><td>120,52 €</td></tr>
        <tr><td>Gramm Gold erhalten</td><td>73,93 g</td><td>87,62 g</td></tr>
        <tr><td>Gewinn bei aktuellem Kurs (162,30 €/g)</td><td>11.998,84 €</td><td>14.220,73 €</td></tr>
      </tbody>
    </table>
    <p>Ergebnis: Trotz der einmaligen Gebühr hat der Kunde nach 10 Jahren rund 20 % mehr Gold – weil der Großhandelspreis den Gebühreneffekt mehr als ausgleicht.</p>
  ` },
  { id: 'bauherrenmodell', title: 'Bauherrenmodell', html: `
    <h2>Bauherrenmodell – Pericon</h2>
    <p>Die Pericon begleitet uns und den Kunden durch den gesamten Prozess.</p>

    <h3>Grundprinzip</h3>
    <p>Die Immobilie zum halben Preis: Man kauft nicht direkt eine Immobilie, sondern beteiligt sich an einer Gesellschaft, in der man gemeinsam mit anderen Bauherr wird und in ein steuerschonendes Objekt investiert.</p>

    <h3>Zielgruppe</h3>
    <p>Am meisten lohnt sich das Modell für Kunden in einer hohen Einkommensstufe – idealerweise in der 50 %-Steuerklasse –, da das Investment von der Steuer absetzbar ist. Das ist eines der wenigen Investments, bei dem das möglich ist.</p>

    <h3>Förderungen &amp; Steuervorteile</h3>
    <p>Entsteht aus einem alten Bestandsobjekt ein neues, saniertes Gebäude, gibt es dafür staatliche Förderungen – und damit einhergehend zusätzliche Steuervorteile. Zwei Voraussetzungen sind dabei entscheidend:</p>
    <ul>
      <li><b>Baubeginn:</b> Das Projekt darf beim Einstieg noch nicht begonnen haben, da der Kunde selbst als Bauherr auftritt.</li>
      <li><b>Mietobergrenze:</b> Die Miete darf maximal 10 € brutto betragen. Nur dann gilt die Wohnung als „gefördert" und die Steuervorteile greifen.</li>
    </ul>

    <h3>Ablauf &amp; Cashflow über die Laufzeit</h3>
    <p>Das Investment durchläuft typischerweise zwei Phasen:</p>
    <ul>
      <li><b>Erste ca. 3 Jahre – Aufbauphase:</b> Der Kunde bringt Eigenmittel ein, es fließen noch keine Gewinne. Dieser Betrag lässt sich aber von der Steuer absetzen – einer der wenigen Fälle, in denen sich ein Investment selbst steuerlich absetzen lässt.</li>
      <li><b>Ab ca. 15–20 Jahren – Ertragsphase:</b> Ab diesem Zeitpunkt erwirtschaftet die Immobilie einen positiven Cashflow.</li>
    </ul>
  ` }
];
