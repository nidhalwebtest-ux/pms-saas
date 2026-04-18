"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import {
  UserIcon,
  PhoneIcon,
  IdentificationIcon,
  HomeIcon,
  BoltIcon,
  TagIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  StarIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { createTenant, updateTenant } from "@/app/dashboard/tenants/actions";

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_NATIONALITIES = [
  "Omani", "Emirati", "Saudi", "Bahraini", "Kuwaiti", "Qatari",
  "Indian", "Pakistani", "Bangladeshi", "Filipino", "Egyptian",
];

const ALL_NATIONALITIES = [
  "Afghan","Albanian","Algerian","American","Argentinian","Australian","Austrian",
  "Bangladeshi","Belgian","Brazilian","British","Bulgarian","Canadian","Chilean",
  "Chinese","Colombian","Czech","Danish","Dutch","Egyptian","Emirati","Ethiopian",
  "Filipino","Finnish","French","German","Greek","Hungarian","Indian","Indonesian",
  "Iranian","Iraqi","Irish","Italian","Japanese","Jordanian","Kenyan","Korean",
  "Kuwaiti","Lebanese","Libyan","Malaysian","Moroccan","Nepali","Nigerian",
  "Norwegian","Omani","Pakistani","Palestinian","Polish","Portuguese","Qatari",
  "Romanian","Russian","Saudi","Singaporean","South African","Spanish","Sri Lankan",
  "Sudanese","Swedish","Swiss","Syrian","Thai","Tunisian","Turkish","Ukrainian",
  "Uzbek","Vietnamese","Yemeni",
].sort();

const ID_TYPE_VALUES = ["national_id", "passport", "resident_card", "driving_license"] as const;
const TENANT_TYPE_VALUES = ["individual", "family", "corporate", "government"] as const;
const SOURCE_VALUES = [
  "walk_in", "phone", "whatsapp", "website", "booking_com", "airbnb",
  "referral", "returning_guest", "corporate_contract", "other",
] as const;
const PAYMENT_METHOD_VALUES = ["cash", "bank_transfer", "card", "cheque"] as const;

const CLASSIFICATION_STYLES = {
  regular:     { Icon: CheckCircleIcon,        active: "border-gray-400 bg-gray-100 text-gray-800" },
  vip:         { Icon: StarIcon,               active: "border-amber-400 bg-amber-50 text-amber-800" },
  blacklisted: { Icon: ShieldExclamationIcon,  active: "border-red-400 bg-red-50 text-red-800" },
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TenantInitialData {
  id: string;
  firstName: string;
  lastName: string;
  fullNameArabic: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  nationalId: string | null;
  idExpiryDate: string | null;
  idDocumentFront: string | null;
  idDocumentBack: string | null;
  phone: string;
  phoneSecondary: string | null;
  whatsappNumber: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  addressLine: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  tenantType: string | null;
  source: string | null;
  classification: string;
  corporateName: string | null;
  corporateContact: string | null;
  preferredFloor: string | null;
  preferredUnitType: string | null;
  preferredPaymentMethod: string | null;
  specialRequests: string | null;
  internalNotes: string | null;
  tags: string[];
}

interface Props {
  initialData?: TenantInitialData | null;
  onSuccess?: (tenant: { id: string; firstName: string; lastName: string }) => void;
}

// ── Collapsible Section ───────────────────────────────────────────────────────

function Section({
  title, icon: Icon, isOpen, onToggle, children, badge,
}: {
  title: string; icon: React.ElementType; isOpen: boolean;
  onToggle: () => void; children: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-start hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {badge}
        </div>
        {isOpen
          ? <ChevronUpIcon   className="h-4 w-4 text-gray-400" />
          : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Tag Input ─────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const tTags = useTranslations("tenants.form.tags");
  const tPh   = useTranslations("tenants.form.placeholders");
  const [input, setInput] = useState("");
  const add = (val: string) => {
    const t = val.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };
  return (
    <div>
      <div className="mb-2 flex min-h-8 flex-wrap gap-1.5">
        {tags.length === 0
          ? <span className="py-1 text-xs text-gray-400">{tTags("noTags")}</span>
          : tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
              {tag}
              <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))}>
                <XMarkIcon className="h-3 w-3 hover:text-blue-900" />
              </button>
            </span>
          ))
        }
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," ) { e.preventDefault(); add(input); }
        }}
        placeholder={tPh("tag")}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <p className="mt-1 text-xs text-gray-400">{tTags("hint")}</p>
    </div>
  );
}

// ── ID Document Upload ────────────────────────────────────────────────────────

function IDDocUpload({
  name, label, defaultUrl,
}: {
  name: string; label: string; defaultUrl: string | null;
}) {
  const tUp = useTranslations("tenants.form.upload");
  const [url, setUrl]           = useState<string | null>(defaultUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const supabase                  = createClient();

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    const path = `id-documents/${Date.now()}-${file.name.replace(/\s/g, "_")}`;
    const { data, error } = await supabase.storage.from("pms-media").upload(path, file, { upsert: true });
    if (error) { toast.error(tUp("failed")); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("pms-media").getPublicUrl(data.path);
    setUrl(publicUrl);
    setUploading(false);
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-600">{label}</p>
      <input type="hidden" name={name} value={url ?? ""} />
      {url ? (
        <div className="group relative h-28 w-full overflow-hidden rounded-xl border border-gray-200">
          <Image src={url} alt={label} fill className="object-cover" unoptimized />
          <button
            type="button"
            onClick={() => setUrl(null)}
            className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all disabled:opacity-60"
        >
          <ArrowUpTrayIcon className="h-6 w-6" />
          <span className="text-xs font-medium">{uploading ? tUp("uploading") : tUp("prompt")}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
      />
    </div>
  );
}

// ── Segmented control helper ──────────────────────────────────────────────────

function SegBtn({
  active, onClick, children, cls = "",
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; cls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
        active
          ? cls || "border-blue-500 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/40"
      }`}
    >
      {active && <CheckIcon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

// ── Quick-Add form (minimal 7-field version) ──────────────────────────────────

function QuickAddForm({
  onSwitchFull, idType, setIdType, tenantType, setTenantType,
  source, setSource, phone, setPhone, nationality, setNationality,
  idNumber, setIdNumber, dupCheck, isPending,
}: {
  onSwitchFull:    () => void;
  idType:          string; setIdType:      (v: string) => void;
  tenantType:      string; setTenantType:  (v: string) => void;
  source:          string; setSource:      (v: string) => void;
  phone:           string; setPhone:       (v: string) => void;
  nationality:     string; setNationality: (v: string) => void;
  idNumber:        string; setIdNumber:    (v: string) => void;
  dupCheck:        DupState;
  isPending:       boolean;
}) {
  const tFld   = useTranslations("tenants.form.fields");
  const tPh    = useTranslations("tenants.form.placeholders");
  const tDup   = useTranslations("tenants.form.duplicate");
  const tQ     = useTranslations("tenants.form.quickAdd");
  const tIdT   = useTranslations("tenants.idTypes");
  const tType  = useTranslations("tenants.types");
  const tSrc   = useTranslations("tenants.sources");

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("firstName")} <span className="text-red-500">*</span></label>
          <input autoFocus name="firstName" required placeholder={tPh("firstName")}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("lastName")} <span className="text-red-500">*</span></label>
          <input name="lastName" required placeholder={tPh("lastName")}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("phone")} <span className="text-red-500">*</span></label>
          <div className="flex">
            <span className="flex items-center rounded-s-lg border border-e-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 ltr-numbers">+968</span>
            <input type="tel" name="phone" required value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder={tPh("phone")}
              className="flex-1 rounded-e-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("nationality")} <span className="text-red-500">*</span></label>
          <input value={nationality} onChange={(e) => setNationality(e.target.value)}
            list="nat-quick" placeholder={tPh("nationalityQuick")} required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <datalist id="nat-quick">
            {[...PRIORITY_NATIONALITIES, ...ALL_NATIONALITIES.filter((n) => !PRIORITY_NATIONALITIES.includes(n))].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">{tFld("idType")} <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-1.5">
            {ID_TYPE_VALUES.map((v) => (
              <button key={v} type="button" onClick={() => setIdType(v)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${idType === v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"}`}>
                {tIdT(v)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("idNumber")} <span className="text-red-500">*</span></label>
          <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required
            placeholder={tPh("idNumberQuick")}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          {dupCheck.status === "checking" && <p className="mt-1 text-xs text-gray-400">{tDup("checking")}</p>}
          {dupCheck.status === "found" && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="flex-1 text-xs font-medium text-amber-800">{tDup("returning", { name: dupCheck.name ?? "" })}</p>
              <Link href={`/dashboard/tenants/${dupCheck.tenantId}`} target="_blank"
                className="shrink-0 text-xs font-semibold text-blue-600 hover:underline">{tDup("viewShort")}</Link>
            </div>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">{tFld("guestType")} <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-1.5">
            {TENANT_TYPE_VALUES.map((v) => (
              <button key={v} type="button" onClick={() => setTenantType(v)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${tenantType === v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"}`}>
                {tType(v)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("source")} <span className="text-red-500">*</span></label>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            {SOURCE_VALUES.map((v) => <option key={v} value={v}>{tSrc(v)}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
        <button type="button" onClick={onSwitchFull}
          className="text-xs font-medium text-blue-600 hover:underline">
          {tQ("switchFull")}
        </button>
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-sm">
          {isPending ? tQ("creating") : tQ("createGuest")}
        </button>
      </div>
    </div>
  );
}

// ── Duplicate detection state type ────────────────────────────────────────────

type DupState = { status: "idle" | "checking" | "found" | "clear"; tenantId?: string; name?: string };

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TenantForm({ initialData, onSuccess }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!initialData;

  const tForm  = useTranslations("tenants.form");
  const tSec   = useTranslations("tenants.form.sections");
  const tFld   = useTranslations("tenants.form.fields");
  const tPh    = useTranslations("tenants.form.placeholders");
  const tDup   = useTranslations("tenants.form.duplicate");
  const tAct   = useTranslations("tenants.form.actions");
  const tToast = useTranslations("tenants.form.toasts");
  const tIdT   = useTranslations("tenants.idTypes");
  const tType  = useTranslations("tenants.types");
  const tSrc   = useTranslations("tenants.sources");
  const tCls   = useTranslations("tenants.classifications");
  const tPay   = useTranslations("tenants.paymentMethods");

  // Mode (only relevant when creating)
  const [quickMode, setQuickMode] = useState(!isEdit);

  // Section collapse state
  const [open, setOpen] = useState({
    personal:       true,
    identification: true,
    contact:        true,
    address:        false,
    emergency:      false,
    classification: true,
    preferences:    false,
  });
  const tog = (k: keyof typeof open) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  // Controlled fields
  const [gender,         setGender]         = useState(initialData?.gender ?? "");
  const [idType,         setIdType]         = useState(initialData?.idType ?? "national_id");
  const [idNumber,       setIdNumber]       = useState(initialData?.idNumber ?? initialData?.nationalId ?? "");
  const [idExpiryDate,   setIdExpiryDate]   = useState(
    initialData?.idExpiryDate ? new Date(initialData.idExpiryDate).toISOString().slice(0, 10) : ""
  );
  const [phone,          setPhone]          = useState(initialData?.phone ?? "");
  const [whatsapp,       setWhatsapp]       = useState(initialData?.whatsappNumber ?? "");
  const [sameAsPhone,    setSameAsPhone]    = useState(false);
  const [nationality,    setNationality]    = useState(initialData?.nationality ?? "");
  const [tenantType,     setTenantType]     = useState(initialData?.tenantType ?? "individual");
  const [source,         setSource]         = useState(initialData?.source ?? "walk_in");
  const [classification, setClassification] = useState(initialData?.classification ?? "regular");
  const [tags,           setTags]           = useState<string[]>(initialData?.tags ?? []);

  // Duplicate detection
  const [dupCheck, setDupCheck] = useState<DupState>({ status: "idle" });
  useEffect(() => {
    if (isEdit || !idNumber || idNumber.length < 3) { setDupCheck({ status: "idle" }); return; }
    setDupCheck({ status: "checking" });
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tenants/check-duplicate?idNumber=${encodeURIComponent(idNumber)}`);
        const d = await r.json();
        setDupCheck(d.exists ? { status: "found", tenantId: d.tenantId, name: d.name } : { status: "clear" });
      } catch { setDupCheck({ status: "idle" }); }
    }, 450);
    return () => clearTimeout(t);
  }, [idNumber, isEdit]);

  // WhatsApp same-as-phone
  useEffect(() => { if (sameAsPhone) setWhatsapp(phone); }, [sameAsPhone, phone]);

  const isIdExpired = idExpiryDate && new Date(idExpiryDate) < new Date();
  const isCorporate = tenantType === "corporate" || tenantType === "government";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Inject controlled state
    fd.set("gender",          gender);
    fd.set("idType",          idType);
    fd.set("idNumber",        idNumber);
    fd.set("phone",           phone);
    fd.set("whatsappNumber",  whatsapp);
    fd.set("nationality",     nationality);
    fd.set("tenantType",      tenantType);
    fd.set("source",          source);
    fd.set("classification",  classification);
    fd.set("tags_json",       JSON.stringify(tags));

    const firstName = (fd.get("firstName") as string)?.trim() ?? "";
    const lastName  = (fd.get("lastName")  as string)?.trim() ?? "";

    startTransition(async () => {
      const res = isEdit ? await updateTenant(fd) : await createTenant(fd);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(isEdit ? tToast("updated") : tToast("created"));
      if (!isEdit && res.id) {
        if (onSuccess) {
          onSuccess({ id: res.id, firstName, lastName });
        } else {
          router.push(`/dashboard/tenants/${res.id}`);
        }
      }
    });
  };

  // ── Quick Add mode ─────────────────────────────────────────────────────────
  if (quickMode && !isEdit) {
    return (
      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
            <span className="rounded-md bg-blue-600 px-4 py-1.5 font-semibold text-white shadow-sm">{tForm("modeQuickAdd")}</span>
            <button type="button" onClick={() => setQuickMode(false)}
              className="rounded-md px-4 py-1.5 font-medium text-gray-500 hover:text-gray-800 transition-colors">
              {tForm("modeFullForm")}
            </button>
          </div>
          <p className="text-xs text-gray-400">{tForm("quickAddTagline")}</p>
        </div>
        <form onSubmit={handleSubmit}>
          {/* hidden fields needed by action */}
          <input type="hidden" name="idType"         value={idType} />
          <input type="hidden" name="idNumber"       value={idNumber} />
          <input type="hidden" name="nationality"    value={nationality} />
          <input type="hidden" name="tenantType"     value={tenantType} />
          <input type="hidden" name="source"         value={source} />
          <input type="hidden" name="classification" value="regular" />
          <input type="hidden" name="tags_json"      value="[]" />
          <input type="hidden" name="gender"         value="" />
          <input type="hidden" name="whatsappNumber" value="" />
          <input type="hidden" name="phone"          value={phone} />
          <QuickAddForm
            onSwitchFull={() => setQuickMode(false)}
            idType={idType} setIdType={setIdType}
            tenantType={tenantType} setTenantType={setTenantType}
            source={source} setSource={setSource}
            phone={phone} setPhone={setPhone}
            nationality={nationality} setNationality={setNationality}
            idNumber={idNumber} setIdNumber={setIdNumber}
            dupCheck={dupCheck} isPending={isPending}
          />
        </form>
      </div>
    );
  }

  // ── Full Form ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      {!isEdit && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
            <button type="button" onClick={() => setQuickMode(true)}
              className="rounded-md px-4 py-1.5 font-medium text-gray-500 hover:text-gray-800 transition-colors">
              {tForm("modeQuickAdd")}
            </button>
            <span className="rounded-md bg-blue-600 px-4 py-1.5 font-semibold text-white shadow-sm">{tForm("modeFullForm")}</span>
          </div>
          <p className="text-xs text-gray-400">{tForm("fullFormTagline")}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isEdit && <input type="hidden" name="id" value={initialData!.id} />}

        {/* ── Section 1: Personal ─────────────────────────────────────── */}
        <Section title={tSec("personal")} icon={UserIcon} isOpen={open.personal} onToggle={() => tog("personal")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("firstName")} <span className="text-red-500">*</span></label>
              <input autoFocus={!isEdit} name="firstName" required defaultValue={initialData?.firstName}
                placeholder={tPh("firstName")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("lastName")} <span className="text-red-500">*</span></label>
              <input name="lastName" required defaultValue={initialData?.lastName}
                placeholder={tPh("lastName")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {tFld("fullNameArabic")} <span className="text-xs font-normal text-gray-400">{tFld("fullNameArabicHint")}</span>
              </label>
              <input name="fullNameArabic" defaultValue={initialData?.fullNameArabic ?? ""} dir="rtl"
                placeholder={tPh("fullNameArabic")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-end text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{tFld("gender")}</label>
              <div className="flex gap-3">
                {(["male", "female"] as const).map((g) => (
                  <label key={g}
                    className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-3 transition-all ${gender === g ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-200"}`}>
                    <input type="radio" className="sr-only" checked={gender === g} onChange={() => setGender(g)} />
                    <span className={`text-sm font-medium ${gender === g ? "text-blue-700" : "text-gray-600"}`}>
                      {g === "male" ? tFld("male") : tFld("female")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("dateOfBirth")} <span className="text-xs font-normal text-gray-400">{tFld("optional")}</span></label>
              <input type="date" name="dateOfBirth"
                defaultValue={initialData?.dateOfBirth ? new Date(initialData.dateOfBirth).toISOString().slice(0, 10) : ""}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {tFld("nationality")} <span className="text-red-500">*</span>
                <span className="ms-2 text-xs font-normal text-gray-400">{tFld("nationalityHint")}</span>
              </label>
              <input value={nationality} onChange={(e) => setNationality(e.target.value)}
                list="nat-full" placeholder={tPh("nationalityFull")} required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <datalist id="nat-full">
                {PRIORITY_NATIONALITIES.map((n) => <option key={`p-${n}`} value={n}>{n} ⭐</option>)}
                {ALL_NATIONALITIES.filter((n) => !PRIORITY_NATIONALITIES.includes(n)).map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
          </div>
        </Section>

        {/* ── Section 2: Identification ────────────────────────────────── */}
        <Section
          title={tSec("identification")}
          icon={IdentificationIcon}
          isOpen={open.identification}
          onToggle={() => tog("identification")}
          badge={isIdExpired ? (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              <ExclamationTriangleIcon className="h-3 w-3" /> {tFld("expiredBadge")}
            </span>
          ) : undefined}
        >
          {/* ID Type selector */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">{tFld("idType")} <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {ID_TYPE_VALUES.map((v) => (
                <SegBtn key={v} active={idType === v} onClick={() => setIdType(v)}>
                  {tIdT(v)}
                </SegBtn>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("idNumber")} <span className="text-red-500">*</span></label>
              <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required
                placeholder={tPh("idNumberFull")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              {/* Duplicate detection feedback */}
              {dupCheck.status === "checking" && (
                <p className="mt-1.5 text-xs text-gray-400">{tDup("checkingFull")}</p>
              )}
              {dupCheck.status === "found" && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-amber-800">{tDup("found")}</p>
                    <p className="text-xs text-amber-700">{dupCheck.name}</p>
                  </div>
                  <Link href={`/dashboard/tenants/${dupCheck.tenantId}`} target="_blank"
                    className="shrink-0 whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline">
                    {tDup("viewProfile")}
                  </Link>
                </div>
              )}
              {dupCheck.status === "clear" && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                  <CheckIcon className="h-3.5 w-3.5" /> {tDup("newGuest")}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {tFld("idExpiry")}
                {isIdExpired && <span className="ms-2 text-xs font-semibold text-red-600">{tFld("expired")}</span>}
              </label>
              <input type="date" value={idExpiryDate} onChange={(e) => setIdExpiryDate(e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                  isIdExpired
                    ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-400/20"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                }`} />
              <p className="mt-1 text-xs text-gray-400">{tFld("expiryWarning")}</p>
            </div>
          </div>

          {/* ID Document Upload */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <IDDocUpload name="idDocumentFront" label={tFld("frontSide")} defaultUrl={initialData?.idDocumentFront ?? null} />
            <IDDocUpload name="idDocumentBack"  label={tFld("backSide")}  defaultUrl={initialData?.idDocumentBack  ?? null} />
          </div>
        </Section>

        {/* ── Section 3: Contact ───────────────────────────────────────── */}
        <Section title={tSec("contact")} icon={PhoneIcon} isOpen={open.contact} onToggle={() => tog("contact")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("phone")} <span className="text-red-500">*</span></label>
              <div className="flex">
                <span className="flex items-center rounded-s-lg border border-e-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 ltr-numbers">+968</span>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder={tPh("phone")}
                  className="flex-1 rounded-e-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("secondaryPhone")} <span className="text-xs font-normal text-gray-400">{tFld("optional")}</span></label>
              <input type="tel" name="phoneSecondary" defaultValue={initialData?.phoneSecondary ?? ""}
                placeholder={tPh("phoneFull")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-700">
                <span>{tFld("whatsapp")} <span className="text-xs font-normal text-gray-400">{tFld("whatsappHint")}</span></span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-normal text-gray-500">
                  <input type="checkbox" checked={sameAsPhone} onChange={(e) => setSameAsPhone(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600" />
                  {tFld("sameAsPhone")}
                </label>
              </label>
              <div className="flex">
                <span className="flex items-center rounded-s-lg border border-e-0 border-gray-300 bg-green-50 px-3 text-xs font-bold text-green-700">WA</span>
                <input type="tel" value={whatsapp}
                  onChange={(e) => { setSameAsPhone(false); setWhatsapp(e.target.value); }}
                  placeholder={tPh("phoneFull")}
                  className="flex-1 rounded-e-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("email")} <span className="text-xs font-normal text-gray-400">{tFld("optional")}</span></label>
              <input type="email" name="email" defaultValue={initialData?.email ?? ""}
                placeholder={tPh("email")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
        </Section>

        {/* ── Section 4: Address (collapsed) ──────────────────────────── */}
        <Section title={tSec("address")} icon={HomeIcon} isOpen={open.address} onToggle={() => tog("address")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("country")}</label>
              <input name="country" defaultValue={initialData?.country ?? ""} list="country-list" placeholder={tPh("country")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <datalist id="country-list">
                {["Oman","UAE","Saudi Arabia","Bahrain","Kuwait","Qatar","India","Pakistan","Bangladesh","Philippines","Egypt"].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("city")}</label>
              <input name="city" defaultValue={initialData?.city ?? ""} placeholder={tPh("city")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("addressLine")}</label>
              <input name="addressLine" defaultValue={initialData?.addressLine ?? ""} placeholder={tPh("addressLine")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
        </Section>

        {/* ── Section 5: Emergency Contact (collapsed) ─────────────────── */}
        <Section title={tSec("emergency")} icon={BoltIcon} isOpen={open.emergency} onToggle={() => tog("emergency")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("name")}</label>
              <input name="emergencyContactName" defaultValue={initialData?.emergencyContactName ?? ""} placeholder={tPh("contactName")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("phone")}</label>
              <input type="tel" name="emergencyContactPhone" defaultValue={initialData?.emergencyContactPhone ?? ""} placeholder={tPh("phoneFull")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("relation")}</label>
              <input name="emergencyContactRelation" defaultValue={initialData?.emergencyContactRelation ?? ""}
                placeholder={tPh("relation")} list="relation-list"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <datalist id="relation-list">
                {["Spouse","Brother","Sister","Father","Mother","Son","Daughter","Friend","Colleague"].map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          </div>
        </Section>

        {/* ── Section 6: Classification ─────────────────────────────────── */}
        <Section title={tSec("classification")} icon={TagIcon} isOpen={open.classification} onToggle={() => tog("classification")}>
          <div className="space-y-4">
            {/* Tenant Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{tFld("guestType")} <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {TENANT_TYPE_VALUES.map((v) => (
                  <SegBtn key={v} active={tenantType === v} onClick={() => setTenantType(v)}>
                    {tType(v)}
                  </SegBtn>
                ))}
              </div>
            </div>
            {/* Corporate fields */}
            {isCorporate && (
              <div className="grid grid-cols-1 gap-4 rounded-xl bg-blue-50 p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("companyName")}</label>
                  <input name="corporateName" defaultValue={initialData?.corporateName ?? ""} placeholder={tPh("companyName")}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("contactPerson")}</label>
                  <input name="corporateContact" defaultValue={initialData?.corporateContact ?? ""} placeholder={tPh("contactPerson")}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            )}
            {/* Source */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("source")} <span className="text-red-500">*</span></label>
              <select value={source} onChange={(e) => setSource(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                {SOURCE_VALUES.map((v) => <option key={v} value={v}>{tSrc(v)}</option>)}
              </select>
            </div>
            {/* Classification (admin) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {tFld("classification")}
                <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{tFld("adminOnly")}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {(["regular", "vip", "blacklisted"] as const).map((v) => {
                  const cfg = CLASSIFICATION_STYLES[v];
                  return (
                    <button key={v} type="button" onClick={() => setClassification(v)}
                      className={`flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                        classification === v ? cfg.active : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}>
                      <cfg.Icon className="h-4 w-4" />
                      {tCls(v)}
                    </button>
                  );
                })}
              </div>
              {classification === "blacklisted" && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <ShieldExclamationIcon className="h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-xs text-red-700">{tFld("blacklistDocReason")}</p>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── Section 7: Preferences & Notes (collapsed) ───────────────── */}
        <Section title={tSec("preferences")} icon={SparklesIcon} isOpen={open.preferences} onToggle={() => tog("preferences")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("preferredFloor")}</label>
              <input name="preferredFloor" defaultValue={initialData?.preferredFloor ?? ""} placeholder={tPh("preferredFloor")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("preferredUnitType")}</label>
              <select name="preferredUnitType" defaultValue={initialData?.preferredUnitType ?? ""}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">{tFld("noPreference")}</option>
                {["Studio","1BR","2BR","3BR","Suite"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("preferredPayment")}</label>
              <select name="preferredPaymentMethod" defaultValue={initialData?.preferredPaymentMethod ?? ""}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">{tFld("noPreference")}</option>
                {PAYMENT_METHOD_VALUES.map((v) => <option key={v} value={v}>{tPay(v)}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{tFld("specialRequests")}</label>
            <textarea name="specialRequests" rows={2} defaultValue={initialData?.specialRequests ?? ""}
              placeholder={tPh("specialRequests")}
              className="block w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              {tFld("internalNotes")}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{tFld("internalNotesHint")}</span>
            </label>
            <textarea name="internalNotes" rows={3} defaultValue={initialData?.internalNotes ?? ""}
              placeholder={tPh("internalNotes")}
              className="block w-full resize-none rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">{tFld("tags")}</label>
            <TagInput tags={tags} onChange={setTags} />
            <input type="hidden" name="tags_json" value={JSON.stringify(tags)} />
          </div>
        </Section>

        {/* ── Submit bar ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <Link
            href={isEdit ? `/dashboard/tenants/${initialData!.id}` : "/dashboard/tenants"}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {tAct("cancel")}
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {isPending
              ? (isEdit ? tAct("saving") : tAct("creating"))
              : (isEdit ? tAct("save") : tAct("create"))}
          </button>
        </div>
      </form>
    </div>
  );
}
