"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import {
  DataTable,
  EmptyState,
  Button,
  useConfirmDialog,
} from "@/components/ui";
import { buildProspectColumns, prospectRowVariant } from "./columns";
import ProspectFormModal from "./ProspectFormModal";
import { deleteProspect } from "./actions";
import type { ProspectRow } from "./page";

export default function ProspectsView({
  prospects,
  hasAnyProspects,
}: {
  prospects: ProspectRow[];
  hasAnyProspects: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProspectRow | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "tier", desc: true }]);

  const columns = useMemo(() => buildProspectColumns(), []);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (p: ProspectRow) => {
    setEditing(p);
    setModalOpen(true);
  };

  const handleDelete = async (p: ProspectRow) => {
    const { confirmed } = await confirm({
      title: "Delete prospect?",
      description: `“${p.businessName}” and all its visits & follow-ups will be permanently removed.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteProspect(p.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Prospect deleted");
      router.refresh();
    });
  };

  const rowActions = useMemo(
    () => (p: ProspectRow) => [
      {
        id: "view",
        label: "Open",
        icon: <EyeIcon className="h-4 w-4" />,
        onClick: () => router.push(`/admin/prospects/${p.id}`),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <PencilSquareIcon className="h-4 w-4" />,
        onClick: () => openEdit(p),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <TrashIcon className="h-4 w-4" />,
        variant: "destructive" as const,
        onClick: () => handleDelete(p),
      },
    ],
    [router],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-fg-tertiary">
          {prospects.length} shown
        </span>
        <Button variant="primary" size="sm" leftIcon={<PlusIcon className="h-4 w-4" />} onClick={openAdd}>
          Add prospect
        </Button>
      </div>

      <DataTable<ProspectRow>
        data={prospects}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        rowActions={rowActions}
        rowVariant={prospectRowVariant}
        onRowClick={(p) => router.push(`/admin/prospects/${p.id}`)}
        emptyState={
          hasAnyProspects ? (
            <EmptyState
              variant="exploratory"
              title="No prospects match"
              description="Try clearing filters or searching a different term."
            />
          ) : (
            <EmptyState
              variant="encouraging"
              illustration={<UserGroupIcon className="h-12 w-12 text-brand-300" />}
              title="No prospects yet"
              description="Add your first Salalah property manager and score them into a tier."
              primaryAction={{
                label: "Add your first prospect",
                onClick: openAdd,
                icon: <PlusIcon className="h-4 w-4" />,
              }}
            />
          )
        }
        aria-label="Prospects"
      />

      {/* Mounted only while open + keyed so the form re-initializes with the
          correct prospect each time (lazy useState init runs once per mount). */}
      {modalOpen && (
        <ProspectFormModal
          key={editing?.id ?? "new"}
          open
          onClose={() => setModalOpen(false)}
          prospect={editing}
        />
      )}
    </div>
  );
}
