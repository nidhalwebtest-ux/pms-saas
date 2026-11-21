"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BuildingOffice2Icon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from "@/components/ui";
import { assignMemberProperties } from "./actions";

interface Building { id: string; name: string }

export default function MemberBuildingsButton({
  memberId,
  buildings,
  assignedIds,
  canAssign,
}: {
  memberId: string;
  buildings: Building[];
  assignedIds: string[];
  canAssign: boolean;
}) {
  const t = useTranslations("settings.team.buildings");
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(assignedIds.length === 0);
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));
  const [pending, startTransition] = useTransition();

  const summary = assignedIds.length === 0
    ? t("allBuildings")
    : t("count", { count: assignedIds.length });

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function reset() {
    setAll(assignedIds.length === 0);
    setSelected(new Set(assignedIds));
  }

  function save() {
    const useAll = all || selected.size === 0;
    startTransition(async () => {
      try {
        await assignMemberProperties(memberId, { all: useAll, propertyIds: [...selected] });
        toast.success(t("saved"));
        setOpen(false);
      } catch (e: any) {
        toast.error(e?.message || t("error"));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => canAssign && (reset(), setOpen(true))}
        disabled={!canAssign}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors ${
          assignedIds.length === 0
            ? "bg-gray-50 text-gray-600 ring-gray-200"
            : "bg-blue-50 text-blue-700 ring-blue-200"
        } ${canAssign ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"}`}
        title={canAssign ? t("edit") : undefined}
      >
        <BuildingOffice2Icon className="h-3.5 w-3.5" />
        {summary}
        {canAssign && <PencilSquareIcon className="h-3 w-3 opacity-60" />}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="md">
        <ModalHeader title={t("title")} />
        <ModalBody>
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" checked={all} onChange={() => setAll(true)}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-900">{t("allBuildings")}</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" checked={!all} onChange={() => setAll(false)}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-900">{t("specific")}</span>
            </label>

            {!all && (
              <div className="mt-1 max-h-64 overflow-y-auto rounded-lg ring-1 ring-gray-200 divide-y divide-gray-100">
                {buildings.map((b) => (
                  <label key={b.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">{b.name}</span>
                  </label>
                ))}
                {buildings.length === 0 && (
                  <p className="px-3 py-4 text-sm text-gray-400 text-center">{t("noBuildings")}</p>
                )}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>{t("cancel")}</Button>
          <Button onClick={save} loading={pending}>{t("save")}</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
