// Rollen aus den Custom Claims des Auth-Tokens (gesetzt von der Cloud Function
// inviteUser, siehe firestore.rules). Reine Funktionen, damit testbar.
export type Role = "admin" | "lead" | "member"

export interface AccountInfo {
  role: Role
  /** ID des verknüpften Mitarbeiters (employees/{id}); null = nicht verknüpft. */
  employeeId: string | null
}

function isRole(v: unknown): v is Role {
  return v === "admin" || v === "lead" || v === "member"
}

/**
 * Übergang: Die bestehenden Editor-Konten wurden vor der Rollenvergabe angelegt
 * und haben keine Claims. Sie gelten bis zur Migration (Phase 5/6) weiter als
 * Admin — sonst wären sie ausgesperrt. Nach der Migration hier auf "member"
 * (bzw. Zugriff verweigern) umstellen.
 */
export function accountFromClaims(claims: Record<string, unknown> | null | undefined): AccountInfo {
  const role = claims?.role
  const employeeId = claims?.employeeId
  return {
    role: isRole(role) ? role : "admin",
    employeeId: typeof employeeId === "string" && employeeId !== "" ? employeeId : null,
  }
}

/** Darf der Account Daten des Mitarbeiters `employeeId` bearbeiten? ancestors = IDs aller Vorgesetzten von employeeId. */
export function canEditEmployee(account: AccountInfo, employeeId: string, ancestors: readonly string[]): boolean {
  if (account.role === "admin") return true
  if (!account.employeeId) return false
  return account.employeeId === employeeId || ancestors.includes(account.employeeId)
}
