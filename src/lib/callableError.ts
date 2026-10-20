/** Fehlertext einer Cloud-Function-Antwort (HttpsError.message) für die Anzeige. */
export function callableErrorText(err: unknown): string {
  const msg = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : ""
  return msg || "Unbekannter Fehler."
}
