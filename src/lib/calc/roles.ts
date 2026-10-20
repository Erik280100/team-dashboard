// Rollen aus den Custom Claims des Auth-Tokens (gesetzt von der Cloud Function
// inviteUser, siehe firestore.rules). Reine Funktionen, damit testbar.
export type Role = "admin" | "lead" | "member"

export interface AccountInfo {
  role: Role
  /** ID des verknüpften Mitarbeiters (employees/{id}); null = nicht verknüpft. */
  employeeId: string | null
  /** Startpasswort noch nicht geändert: bis dahin sperrt firestore.rules jeden Datenzugriff. */
  mustChangePassword: boolean
}

function isRole(v: unknown): v is Role {
  return v === "admin" || v === "lead" || v === "member"
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

/** Darf der Account Daten des Mitarbeiters `employeeId` bearbeiten? ancestors = IDs aller Vorgesetzten von employeeId. */
export function canEditEmployee(account: AccountInfo, employeeId: string, ancestors: readonly string[]): boolean {
  if (account.role === "admin") return true
  if (!account.employeeId) return false
  return account.employeeId === employeeId || ancestors.includes(account.employeeId)
}
