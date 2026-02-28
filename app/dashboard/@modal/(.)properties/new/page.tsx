import SlideOver from "@/components/ui/SlideOver";
import PropertyForm from "@/components/dashboard/PropertyForm";

export default function InterceptedNewPropertyPage() {
  return (
    <SlideOver title="Add New Property">
      <div className="pb-10 px-2 sm:px-4">
        {/* Reuse the exact same component! */}
        <PropertyForm />
      </div>
    </SlideOver>
  );
}
