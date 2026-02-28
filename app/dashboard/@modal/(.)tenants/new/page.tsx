import SlideOver from "@/components/ui/SlideOver";
import TenantForm from "@/components/dashboard/TenantForm";

export default function InterceptedNewTenantPage() {
  return (
    <SlideOver title="Add New Tenant">
      <div className="pb-10 px-2 sm:px-4">
        <TenantForm />
      </div>
    </SlideOver>
  );
}
