import { redirect } from "next/navigation";

/** Sales Targets moved: entry → Settings, Target-vs-Actual → Reports. */
export default function SalesTargetsRedirect() {
  redirect("/dashboard/settings/sales-targets");
}
