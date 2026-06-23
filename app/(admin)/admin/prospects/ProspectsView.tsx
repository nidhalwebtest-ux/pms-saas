"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin");
  const confirm = useConfirmDialog();
  const [, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProspectRow | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "tier", desc: true }]);

  const columns = useMemo(() => buildProspectColumns(t), [t]);

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
      title: t("prospects.deleteDialog.title"),
      description: t("prospects.deleteDialog.desc", { name: p.businessName }),
      confirmLabel: t("prospects.deleteDialog.confirm"),
      tone: "destructive",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteProspect(p.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("prospects.toast.deleted"));
      router.refresh();
    });
  };

  const rowActions = useMemo(
    () => (p: ProspectRow) => [
      {
        id: "view",
        label: t("common.open"),
        icon: <EyeIcon className="h-4 w-4" />,
        onClick: () => router.push(`/admin/prospects/${p.id}`),
      },
      {
        id: "edit",
        label: t("common.edit"),
        icon: <PencilSquareIcon className="h-4 w-4" />,
        onClick: () => openEdit(p),
      },
      {
        id: "delete",
        label: t("common.delete"),
        icon: <TrashIcon className="h-4 w-4" />,
        variant: "destructive" as const,
        onClick: () => handleDelete(p),
      },
    ],
    [router, t],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-fg-tertiary">
          {t("common.shownCount", { count: prospects.length })}
        </span>
        <Button variant="primary" size="sm" leftIcon={<PlusIcon className="h-4 w-4" />} onClick={openAdd}>
          {t("prospects.addProspect")}
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
              title={t("prospects.empty.noMatchTitle")}
              description={t("prospects.empty.noMatchDesc")}
            />
          ) : (
            <EmptyState
              variant="encouraging"
              illustration={<UserGroupIcon className="h-12 w-12 text-brand-300" />}
              title={t("prospects.empty.firstTitle")}
              description={t("prospects.empty.firstDesc")}
              primaryAction={{
                label: t("prospects.empty.firstCta"),
                onClick: openAdd,
                icon: <PlusIcon className="h-4 w-4" />,
              }}
            />
          )
        }
        aria-label={t("prospects.table")}
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
