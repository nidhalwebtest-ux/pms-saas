import { getTranslations } from "next-intl/server";
import SlideOver from "@/components/ui/SlideOver";
import PropertyForm from "@/components/dashboard/PropertyForm";

export default async function InterceptedNewPropertyPage() {
  const t = await getTranslations("dashboard.modals");
  return (
    <SlideOver title={t("addNewProperty")}>
      <div className="pb-10 px-2 sm:px-4">
        <PropertyForm />
      </div>
    </SlideOver>
  );
}
