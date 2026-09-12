"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { PhoneInput, TextField, Select } from "@/components/ui";
import { createVendor, updateVendor } from "@/app/dashboard/vendors/actions";

export interface VendorInitialData {
  id: string;
  name: string;
  nameAr: string | null;
  categoryId: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  taxNumber: string | null;
  bankAccountName: string | null;
  bankName: string | null;
  accountNumber: string | null;
}

interface Props {
  initialData?: VendorInitialData | null;
  categories: { id: string; name: string; nameAr: string | null }[];
  onSuccess?: (vendor: { id: string; name: string }) => void;
}

export default function VendorForm({ initialData, categories, onSuccess }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!initialData;

  const tForm = useTranslations("vendors.form");
  const tFld = useTranslations("vendors.form.fields");
  const tPh = useTranslations("vendors.form.placeholders");
  const tAct = useTranslations("vendors.form.actions");
  const tToast = useTranslations("vendors.form.toasts");

  const [name, setName] = useState(initialData?.name ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("name", name);
    fd.set("phone", phone);

    startTransition(async () => {
      const res = isEdit ? await updateVendor(fd) : await createVendor(fd);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(isEdit ? tToast("updated") : tToast("created"));
      if (isEdit) {
        router.push(`/dashboard/vendors/${initialData!.id}`);
      } else if (res.id) {
        if (onSuccess) {
          onSuccess({ id: res.id, name: name.trim() });
        } else {
          router.push("/dashboard/vendors");
        }
      }
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isEdit && <input type="hidden" name="id" value={initialData!.id} />}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">{tForm("sections.details")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={tFld("name")}
            name="name"
            required
            autoFocus={!isEdit}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tPh("name")}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {tFld("nameAr")} <span className="text-xs font-normal text-gray-400">{tFld("optional")}</span>
            </label>
            <input
              name="nameAr"
              dir="rtl"
              defaultValue={initialData?.nameAr ?? ""}
              placeholder={tPh("nameAr")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-end text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <Select
            label={tFld("category")}
            name="categoryId"
            defaultValue={initialData?.categoryId ?? ""}
            placeholder={tPh("category")}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextField
            label={tFld("contactPerson")}
            name="contactPerson"
            defaultValue={initialData?.contactPerson ?? ""}
            placeholder={tPh("contactPerson")}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("phone")}</label>
            <PhoneInput name="phone" value={phone} onValueChange={setPhone} placeholder={tPh("phone")} />
          </div>
          <TextField
            label={tFld("email")}
            name="email"
            type="email"
            defaultValue={initialData?.email ?? ""}
            placeholder={tPh("email")}
          />
          <div className="sm:col-span-2">
            <TextField
              label={tFld("address")}
              name="address"
              defaultValue={initialData?.address ?? ""}
              placeholder={tPh("address")}
            />
          </div>
          <TextField
            label={tFld("taxNumber")}
            name="taxNumber"
            defaultValue={initialData?.taxNumber ?? ""}
            placeholder={tPh("taxNumber")}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">{tForm("sections.bank")}</h3>
        <p className="text-xs text-gray-400">{tForm("bankHint")}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField
            label={tFld("bankAccountName")}
            name="bankAccountName"
            defaultValue={initialData?.bankAccountName ?? ""}
            placeholder={tPh("bankAccountName")}
          />
          <TextField
            label={tFld("bankName")}
            name="bankName"
            defaultValue={initialData?.bankName ?? ""}
            placeholder={tPh("bankName")}
          />
          <TextField
            label={tFld("accountNumber")}
            name="accountNumber"
            defaultValue={initialData?.accountNumber ?? ""}
            placeholder={tPh("accountNumber")}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">{tForm("sections.notes")}</h3>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initialData?.notes ?? ""}
          placeholder={tPh("notes")}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {tAct("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60 transition-colors"
        >
          {isPending ? tAct("saving") : isEdit ? tAct("save") : tAct("create")}
        </button>
      </div>
    </form>
  );
}
