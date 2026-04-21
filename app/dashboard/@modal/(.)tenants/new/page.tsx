import { getTranslations } from "next-intl/server";
import SlideOver from "@/components/ui/SlideOver";
import TenantForm from "@/components/dashboard/TenantForm";

export default async function InterceptedNewTenantPage() {
  const t = await getTranslations("dashboard.modals");
  return (
    <SlideOver title={t("addNewTenant")}>
      <div className="pb-10 px-2 sm:px-4">
        <TenantForm />
      </div>
    </SlideOver>
  );
}
