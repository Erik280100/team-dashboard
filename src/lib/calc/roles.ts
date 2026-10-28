// Rollen aus den Custom Claims des Auth-Tokens (gesetzt von der Cloud Function
// inviteUser, siehe firestore.rules). Reine Funktionen, damit testbar.
/** "viewer" = reiner Lesemodus: sieht alle Daten und Seiten, darf nichts ändern (firestore.rules). */
export type Role = "admin" | "lead" | "member" | "viewer"

export interface AccountInfo {
  role: Role
  /** ID des verknüpften Mitarbeiters (employees/{id}); null = nicht verknüpft. */
  employeeId: string | null
  /** Startpasswort noch nicht geändert: bis dahin sperrt firestore.rules jeden Datenzugriff. */
  mustChangePassword: boolean
}

function isRole(v: unknown): v is Role {
  return v === "admin" || v === "lead" || v === "member" || v === "viewer"
}

/**
 * Konten ohne gültige Rolle (alte Logins ohne Claims) bekommen keine Rechte: "member" ohne verknüpften
 * Mitarbeiter. firestore.rules verweigert ihnen ohnehin jeden Datenzugriff.
 */
export function accountFromClaims(claims: Record<string, unknown> | null | undefined): AccountInfo {
  const role = claims?.role
  const employeeId = claims?.employeeId
  return {
    role: isRole(role) ? role : "member",
    employeeId: typeof employeeId === "string" && employeeId !== "" ? employeeId : null,
    mustChangePassword: claims?.mustChangePassword === true,
  }
}

/** Liest der Account alle Daten (Admin und Lesemodus)? Das Schreiben bleibt dem Admin vorbehalten. */
export function canReadAll(role: Role): boolean {
  return role === "admin" || role === "viewer"
}

/** Darf der Account Daten des Mitarbeiters `employeeId` sehen? (Lesemodus: alle.) */
export function canViewEmployee(account: AccountInfo, employeeId: string, ancestors: readonly string[]): boolean {
  return account.role === "viewer" || canEditEmployee(account, employeeId, ancestors)
}

/** Darf der Account Daten des Mitarbeiters `employeeId` bearbeiten? ancestors = IDs aller Vorgesetzten von employeeId. */
export function canEditEmployee(account: AccountInfo, employeeId: string, ancestors: readonly string[]): boolean {
  if (account.role === "admin") return true
  if (account.role === "viewer" || !account.employeeId) return false
  return account.employeeId === employeeId || ancestors.includes(account.employeeId)
}
