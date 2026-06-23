"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon, TrashIcon, CheckIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { TextField, Button, useConfirmDialog } from "@/components/ui";
import type { AreaOption } from "../_lib/area-label";
import { createArea, updateArea, deleteArea } from "./area-actions";

const DEFAULT_COLOR = "#185FA5";

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-md border border-border-default bg-surface p-0.5"
      aria-label="color"
    />
  );
}

function AreaRow({ area }: { area: AreaOption }) {
  const router = useRouter();
  const t = useTranslations("admin.settings.areas");
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(area.name);
  const [nameAr, setNameAr] = useState(area.nameAr ?? "");
  const [color, setColor] = useState(area.color || DEFAULT_COLOR);

  const dirty =
    name !== area.name || nameAr !== (area.nameAr ?? "") || color !== (area.color || DEFAULT_COLOR);

  const save = () => {
    if (!name.trim()) { toast.error(t("nameRequired")); return; }
    const fd = new FormData();
    fd.set("id", area.id);
    fd.set("name", name);
    fd.set("nameAr", nameAr);
    fd.set("color", color);
    startTransition(async () => {
      const res = await updateArea(fd);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("saved"));
      router.refresh();
    });
  };

  const remove = async () => {
    const { confirmed } = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDesc", { name: area.name }),
      confirmLabel: t("deleteConfirm"),
      tone: "destructive",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteArea(area.id);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("deleted"));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border-subtle bg-canvas p-2.5 sm:flex-nowrap">
      <ColorSwatch value={color} onChange={setColor} />
      <div className="min-w-[8rem] flex-1">
        <TextField label={t("nameEn")} value={name} onChange={(e) => setName(e.target.value)} reserveMessageSpace={false} />
      </div>
      <div className="min-w-[8rem] flex-1">
        <TextField label={t("nameAr")} value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" reserveMessageSpace={false} />
      </div>
      <div className="flex items-center gap-1.5">
        {dirty && (
          <Button variant="primary" size="sm" onClick={save} loading={pending} leftIcon={<CheckIcon className="h-4 w-4" />}>
            {t("save")}
          </Button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-tertiary hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
          title={t("deleteConfirm")}
          aria-label={t("deleteConfirm")}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AddArea() {
  const router = useRouter();
  const t = useTranslations("admin.settings.areas");
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);

  const add = () => {
    if (!name.trim()) { toast.error(t("nameRequired")); return; }
    const fd = new FormData();
    fd.set("name", name);
    fd.set("nameAr", nameAr);
    fd.set("color", color);
    startTransition(async () => {
      const res = await createArea(fd);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("added"));
      setName(""); setNameAr(""); setColor(DEFAULT_COLOR);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border-default p-2.5 sm:flex-nowrap">
      <ColorSwatch value={color} onChange={setColor} />
      <div className="min-w-[8rem] flex-1">
        <TextField label={t("nameEn")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("nameEnPh")} reserveMessageSpace={false} />
      </div>
      <div className="min-w-[8rem] flex-1">
        <TextField label={t("nameAr")} value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={t("nameArPh")} dir="rtl" reserveMessageSpace={false} />
      </div>
      <Button variant="secondary" size="sm" onClick={add} loading={pending} leftIcon={<PlusIcon className="h-4 w-4" />}>
        {t("add")}
      </Button>
    </div>
  );
}

export default function AreasManager({ areas }: { areas: AreaOption[] }) {
  const t = useTranslations("admin.settings.areas");
  return (
    <section className="rounded-2xl border border-border-default bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <MapPinIcon className="h-5 w-5 text-brand-600" />
        <h3 className="text-sm font-semibold text-fg">{t("title")}</h3>
      </div>
      <p className="mt-0.5 text-xs text-fg-tertiary">{t("hint")}</p>

      <div className="mt-4 space-y-2">
        {areas.map((a) => (
          <AreaRow key={a.id} area={a} />
        ))}
        <AddArea />
      </div>
    </section>
  );
}
