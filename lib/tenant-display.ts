/**
 * Primary display name for a tenant. For corporate/government tenants with a
 * company name, the company is the identity; individuals are person-named
 * (QA #25 — keep this consistent across detail, list, today view, PDFs).
 */
export function tenantDisplayName(t: {
  firstName:      string;
  lastName:       string;
  tenantType?:    string | null;
  corporateName?: string | null;
}): string {
  const isCorporate =
    (t.tenantType === "corporate" || t.tenantType === "government") && !!t.corporateName;
  return isCorporate
    ? t.corporateName!.trim()
    : `${t.firstName} ${t.lastName}`.trim();
}
