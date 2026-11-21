import { PageHeader } from "@/components/ui/FormComponents";
import PropertyForm from "@/components/dashboard/PropertyForm";
import { getTranslations } from "next-intl/server";

export default async function NewPropertyPage() {
  const t = await getTranslations("buildings.form");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title={t("newTitle")}
        description={t("newDescription")}
        listHref="/dashboard/properties"
      />

      {/* Render the form in Create mode (no initialData) */}
      <PropertyForm />
    </div>
  );
}
