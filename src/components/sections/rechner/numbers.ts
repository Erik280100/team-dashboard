// Zahlen-Parser der Rechner-Eingabefelder (Texteingabe -> Zahl).
export function n(v: string): number {
  return Number(v) || 0
}
