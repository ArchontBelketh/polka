// User scenarios share one account. Staff privileges remain separate from selling.
export function canManageCode(role: string | undefined) {
  return role === "DEVELOPER" || role === "ADMIN"
}

export function isStaff(role: string | undefined) {
  return role === "MODERATOR" || role === "ADMIN"
}
