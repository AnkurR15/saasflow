export function isPlatformAdmin(user: { id?: string } | undefined | null): boolean {
  const adminId = process.env.ADMIN_USER_ID?.trim();
  return Boolean(adminId && user?.id === adminId);
}
