import AccessDenied from "@/components/dashboard/AccessDenied";

// Shown when a permission guard (assertView) blocks access to a record/page.
export default function NoAccessPage() {
  return <AccessDenied />;
}
