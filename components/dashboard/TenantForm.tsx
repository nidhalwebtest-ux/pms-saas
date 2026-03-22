"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
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
  GlobeAltIcon,
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

const ID_TYPES = [
  { value: "national_id",     label: "National ID"     },
  { value: "passport",        label: "Passport"        },
  { value: "resident_card",   label: "Resident Card"   },
  { value: "driving_license", label: "Driving License" },
];

const TENANT_TYPES = [
  { value: "individual",  label: "Individual" },
  { value: "family",      label: "Family"     },
  { value: "corporate",   label: "Corporate"  },
  { value: "government",  label: "Government" },
];

const SOURCES = [
  { value: "walk_in",           label: "Walk-in"          },
  { value: "phone",             label: "Phone"            },
  { value: "whatsapp",          label: "WhatsApp"         },
  { value: "website",           label: "Website"          },
  { value: "booking_com",       label: "Booking.com"      },
  { value: "airbnb",            label: "Airbnb"           },
  { value: "referral",          label: "Referral"         },
  { value: "returning_guest",   label: "Returning Guest"  },
  { value: "corporate_contract",label: "Corporate Contract"},
  { value: "other",             label: "Other"            },
];

const PAYMENT_METHODS = [
  { value: "cash",          label: "Cash"          },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card",          label: "Card"          },
  { value: "cheque",        label: "Cheque"        },
];

const CLASSIFICATIONS = [
  { value: "regular",    label: "Regular",    Icon: CheckCircleIcon, active: "border-gray-400 bg-gray-100 text-gray-800"       },
  { value: "vip",        label: "VIP",        Icon: StarIcon,        active: "border-amber-400 bg-amber-50 text-amber-800"      },
  { value: "blacklisted",label: "Blacklisted",Icon: ShieldExclamationIcon, active: "border-red-400 bg-red-50 text-red-800" },
];

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
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
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
          ? <span className="py-1 text-xs text-gray-400">No tags yet</span>
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
        placeholder="Type a tag and press Enter (e.g. khareef-regular, vip-client)"
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <p className="mt-1 text-xs text-gray-400">Press Enter or comma to add a tag</p>
    </div>
  );
}

// ── ID Document Upload ────────────────────────────────────────────────────────

function IDDocUpload({
  name, label, defaultUrl,
}: {
  name: string; label: string; defaultUrl: string | null;
}) {
  const [url, setUrl]           = useState<string | null>(defaultUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const supabase                  = createClient();

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    const path = `id-documents/${Date.now()}-${file.name.replace(/\s/g, "_")}`;
    const { data, error } = await supabase.storage.from("pms-media").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
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
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
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
          <span className="text-xs font-medium">{uploading ? "Uploading…" : "Upload or capture"}</span>
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
  return (
    <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">First Name <span className="text-red-500">*</span></label>
          <input autoFocus name="firstName" required placeholder="Ahmed"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
          <input name="lastName" required placeholder="Al-Said"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone <span className="text-red-500">*</span></label>
          <div className="flex">
            <span className="flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">+968</span>
            <input type="tel" name="phone" required value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="9000 0000"
              className="flex-1 rounded-r-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nationality <span className="text-red-500">*</span></label>
          <input value={nationality} onChange={(e) => setNationality(e.target.value)}
            list="nat-quick" placeholder="Omani" required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <datalist id="nat-quick">
            {[...PRIORITY_NATIONALITIES, ...ALL_NATIONALITIES.filter((n) => !PRIORITY_NATIONALITIES.includes(n))].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">ID Type <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-1.5">
            {ID_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setIdType(t.value)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${idType === t.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">ID Number <span className="text-red-500">*</span></label>
          <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required
            placeholder="Enter ID / passport number"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          {dupCheck.status === "checking" && <p className="mt-1 text-xs text-gray-400">Checking…</p>}
          {dupCheck.status === "found" && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="flex-1 text-xs font-medium text-amber-800">Returning guest — {dupCheck.name}</p>
              <Link href={`/dashboard/tenants/${dupCheck.tenantId}`} target="_blank"
                className="shrink-0 text-xs font-semibold text-blue-600 hover:underline">View →</Link>
            </div>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Guest Type <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-1.5">
            {TENANT_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setTenantType(t.value)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${tenantType === t.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Source <span className="text-red-500">*</span></label>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
        <button type="button" onClick={onSwitchFull}
          className="text-xs font-medium text-blue-600 hover:underline">
          Need more fields? Switch to Full Form →
        </button>
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-sm">
          {isPending ? "Creating…" : "Create Guest"}
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
      toast.success(isEdit ? "Tenant updated!" : "Tenant created!");
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
            <span className="rounded-md bg-blue-600 px-4 py-1.5 font-semibold text-white shadow-sm">⚡ Quick Add</span>
            <button type="button" onClick={() => setQuickMode(false)}
              className="rounded-md px-4 py-1.5 font-medium text-gray-500 hover:text-gray-800 transition-colors">
              Full Form
            </button>
          </div>
          <p className="text-xs text-gray-400">Fastest for walk-in guests during busy hours</p>
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
              ⚡ Quick Add
            </button>
            <span className="rounded-md bg-blue-600 px-4 py-1.5 font-semibold text-white shadow-sm">Full Form</span>
          </div>
          <p className="text-xs text-gray-400">Complete guest profile with all details</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isEdit && <input type="hidden" name="id" value={initialData!.id} />}

        {/* ── Section 1: Personal ─────────────────────────────────────── */}
        <Section title="Personal Information" icon={UserIcon} isOpen={open.personal} onToggle={() => tog("personal")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">First Name <span className="text-red-500">*</span></label>
              <input autoFocus={!isEdit} name="firstName" required defaultValue={initialData?.firstName}
                placeholder="Ahmed"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
              <input name="lastName" required defaultValue={initialData?.lastName}
                placeholder="Al-Said"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Full Name in Arabic <span className="text-xs font-normal text-gray-400">(optional — for official documents)</span>
              </label>
              <input name="fullNameArabic" defaultValue={initialData?.fullNameArabic ?? ""} dir="rtl"
                placeholder="أحمد السعيد"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Gender</label>
              <div className="flex gap-3">
                {["male", "female"].map((g) => (
                  <label key={g}
                    className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-3 transition-all ${gender === g ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-200"}`}>
                    <input type="radio" className="sr-only" checked={gender === g} onChange={() => setGender(g)} />
                    <span className={`text-sm font-medium ${gender === g ? "text-blue-700" : "text-gray-600"}`}>
                      {g === "male" ? "♂ Male" : "♀ Female"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Date of Birth <span className="text-xs font-normal text-gray-400">(optional)</span></label>
              <input type="date" name="dateOfBirth"
                defaultValue={initialData?.dateOfBirth ? new Date(initialData.dateOfBirth).toISOString().slice(0, 10) : ""}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Nationality <span className="text-red-500">*</span>
                <span className="ml-2 text-xs font-normal text-gray-400">— GCC &amp; Asia at top</span>
              </label>
              <input value={nationality} onChange={(e) => setNationality(e.target.value)}
                list="nat-full" placeholder="Type or select nationality…" required
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
          title="Identification"
          icon={IdentificationIcon}
          isOpen={open.identification}
          onToggle={() => tog("identification")}
          badge={isIdExpired ? (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              <ExclamationTriangleIcon className="h-3 w-3" /> Expired ID
            </span>
          ) : undefined}
        >
          {/* ID Type selector */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">ID Type <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {ID_TYPES.map((t) => (
                <SegBtn key={t.value} active={idType === t.value} onClick={() => setIdType(t.value)}>
                  {t.label}
                </SegBtn>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">ID Number <span className="text-red-500">*</span></label>
              <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required
                placeholder="Enter number exactly as on document"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              {/* Duplicate detection feedback */}
              {dupCheck.status === "checking" && (
                <p className="mt-1.5 text-xs text-gray-400">Checking for duplicate…</p>
              )}
              {dupCheck.status === "found" && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-amber-800">This guest has stayed before!</p>
                    <p className="text-xs text-amber-700">{dupCheck.name}</p>
                  </div>
                  <Link href={`/dashboard/tenants/${dupCheck.tenantId}`} target="_blank"
                    className="shrink-0 whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline">
                    View Profile →
                  </Link>
                </div>
              )}
              {dupCheck.status === "clear" && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                  <CheckIcon className="h-3.5 w-3.5" /> New guest
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                ID Expiry Date
                {isIdExpired && <span className="ml-2 text-xs font-semibold text-red-600">⚠ Expired</span>}
              </label>
              <input type="date" value={idExpiryDate} onChange={(e) => setIdExpiryDate(e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                  isIdExpired
                    ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-400/20"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                }`} />
              <p className="mt-1 text-xs text-gray-400">Warning shown if expired, but submission still allowed</p>
            </div>
          </div>

          {/* ID Document Upload */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <IDDocUpload name="idDocumentFront" label="Front Side" defaultUrl={initialData?.idDocumentFront ?? null} />
            <IDDocUpload name="idDocumentBack"  label="Back Side"  defaultUrl={initialData?.idDocumentBack  ?? null} />
          </div>
        </Section>

        {/* ── Section 3: Contact ───────────────────────────────────────── */}
        <Section title="Contact Information" icon={PhoneIcon} isOpen={open.contact} onToggle={() => tog("contact")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone <span className="text-red-500">*</span></label>
              <div className="flex">
                <span className="flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">+968</span>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="9000 0000"
                  className="flex-1 rounded-r-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Secondary Phone <span className="text-xs font-normal text-gray-400">(optional)</span></label>
              <input type="tel" name="phoneSecondary" defaultValue={initialData?.phoneSecondary ?? ""}
                placeholder="+968 9000 0000"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-700">
                <span>WhatsApp <span className="text-xs font-normal text-gray-400">(primary in Oman)</span></span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-normal text-gray-500">
                  <input type="checkbox" checked={sameAsPhone} onChange={(e) => setSameAsPhone(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600" />
                  Same as phone
                </label>
              </label>
              <div className="flex">
                <span className="flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-green-50 px-3 text-xs font-bold text-green-700">WA</span>
                <input type="tel" value={whatsapp}
                  onChange={(e) => { setSameAsPhone(false); setWhatsapp(e.target.value); }}
                  placeholder="+968 9000 0000"
                  className="flex-1 rounded-r-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email <span className="text-xs font-normal text-gray-400">(optional)</span></label>
              <input type="email" name="email" defaultValue={initialData?.email ?? ""}
                placeholder="guest@email.com"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
        </Section>

        {/* ── Section 4: Address (collapsed) ──────────────────────────── */}
        <Section title="Address" icon={HomeIcon} isOpen={open.address} onToggle={() => tog("address")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Country</label>
              <input name="country" defaultValue={initialData?.country ?? ""} list="country-list" placeholder="Oman"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <datalist id="country-list">
                {["Oman","UAE","Saudi Arabia","Bahrain","Kuwait","Qatar","India","Pakistan","Bangladesh","Philippines","Egypt"].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">City</label>
              <input name="city" defaultValue={initialData?.city ?? ""} placeholder="Salalah"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Address Line</label>
              <input name="addressLine" defaultValue={initialData?.addressLine ?? ""} placeholder="Street, building…"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
        </Section>

        {/* ── Section 5: Emergency Contact (collapsed) ─────────────────── */}
        <Section title="Emergency Contact" icon={BoltIcon} isOpen={open.emergency} onToggle={() => tog("emergency")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
              <input name="emergencyContactName" defaultValue={initialData?.emergencyContactName ?? ""} placeholder="Contact name"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" name="emergencyContactPhone" defaultValue={initialData?.emergencyContactPhone ?? ""} placeholder="+968 9000 0000"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Relation</label>
              <input name="emergencyContactRelation" defaultValue={initialData?.emergencyContactRelation ?? ""}
                placeholder="Spouse, Brother, Friend…" list="relation-list"
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
        <Section title="Guest Classification" icon={TagIcon} isOpen={open.classification} onToggle={() => tog("classification")}>
          <div className="space-y-4">
            {/* Tenant Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Guest Type <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {TENANT_TYPES.map((t) => (
                  <SegBtn key={t.value} active={tenantType === t.value} onClick={() => setTenantType(t.value)}>
                    {t.label}
                  </SegBtn>
                ))}
              </div>
            </div>
            {/* Corporate fields */}
            {isCorporate && (
              <div className="grid grid-cols-1 gap-4 rounded-xl bg-blue-50 p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Company Name</label>
                  <input name="corporateName" defaultValue={initialData?.corporateName ?? ""} placeholder="e.g. Dhofar Tourism LLC"
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Contact Person</label>
                  <input name="corporateContact" defaultValue={initialData?.corporateContact ?? ""} placeholder="Name of contact person"
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            )}
            {/* Source */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Source <span className="text-red-500">*</span></label>
              <select value={source} onChange={(e) => setSource(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {/* Classification (admin) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Classification
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Admin only</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CLASSIFICATIONS.map((c) => (
                  <button key={c.value} type="button" onClick={() => setClassification(c.value)}
                    className={`flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                      classification === c.value ? c.active : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}>
                    <c.Icon className="h-4 w-4" />
                    {c.label}
                  </button>
                ))}
              </div>
              {classification === "blacklisted" && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <ShieldExclamationIcon className="h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-xs text-red-700">Please document the reason in Internal Notes below</p>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── Section 7: Preferences & Notes (collapsed) ───────────────── */}
        <Section title="Preferences & Notes" icon={SparklesIcon} isOpen={open.preferences} onToggle={() => tog("preferences")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Preferred Floor</label>
              <input name="preferredFloor" defaultValue={initialData?.preferredFloor ?? ""} placeholder="Ground floor, High floor…"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Preferred Unit Type</label>
              <select name="preferredUnitType" defaultValue={initialData?.preferredUnitType ?? ""}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">No preference</option>
                {["Studio","1BR","2BR","3BR","Suite"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Preferred Payment</label>
              <select name="preferredPaymentMethod" defaultValue={initialData?.preferredPaymentMethod ?? ""}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">No preference</option>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Special Requests</label>
            <textarea name="specialRequests" rows={2} defaultValue={initialData?.specialRequests ?? ""}
              placeholder="e.g. Extra bed needed, Late check-in, Quiet unit, Baby cot…"
              className="block w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              Internal Notes
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Staff only — not visible to guest</span>
            </label>
            <textarea name="internalNotes" rows={3} defaultValue={initialData?.internalNotes ?? ""}
              placeholder="e.g. Always pays late. VIP — give best available unit. Blacklisted reason…"
              className="block w-full resize-none rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Tags</label>
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
            ← Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {isPending
              ? (isEdit ? "Saving…" : "Creating…")
              : (isEdit ? "Save Changes" : "Create Tenant")}
          </button>
        </div>
      </form>
    </div>
  );
}
