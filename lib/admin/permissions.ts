export const adminRoles = ['owner', 'admin', 'operator', 'analyst'] as const;
export type AdminRole = (typeof adminRoles)[number];
export const adminPermissions = ['overview.read', 'catalog.read', 'contacts.read', 'contacts.manage', 'tasks.manage', 'activity.read', 'data.export', 'access.manage'] as const;
export type AdminPermission = (typeof adminPermissions)[number];
export const rolePermissions: Record<AdminRole, readonly AdminPermission[]> = {
  analyst: ['overview.read', 'catalog.read', 'activity.read'],
  operator: ['overview.read', 'catalog.read', 'contacts.read', 'contacts.manage', 'tasks.manage', 'activity.read'],
  admin: ['overview.read', 'catalog.read', 'contacts.read', 'contacts.manage', 'tasks.manage', 'activity.read', 'data.export'],
  owner: [...adminPermissions],
};
/** UI guidance only. PostgreSQL independently enforces every permission. */
export function hasAdminPermission(permissions: readonly string[], permission: AdminPermission): boolean {
  return permissions.includes(permission);
}
