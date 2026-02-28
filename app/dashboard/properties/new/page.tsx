import { PageHeader } from "@/components/ui/FormComponents";
import PropertyForm from "@/components/dashboard/PropertyForm"; // Import the new form

export default function NewPropertyPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title="Add New Property"
        description="Enter the details of the building, hotel, or compound."
        listHref="/dashboard/properties"
      />

      {/* Render the form in Create mode (no initialData) */}
      <PropertyForm />
    </div>
  );
}
