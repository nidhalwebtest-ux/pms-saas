import { BellIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { logout } from "@/app/login/actions";
import { ROLE_LABELS, ROLE_BADGE, type Role } from "@/lib/permissions";
import PropertySelector from "./PropertySelector";

interface Props {
  userEmail:         string | undefined;
  userName:          string | null | undefined;
  role:              Role;
  properties:        { id: string; name: string }[];
  selectedPropertyId: string;
}

export default function Header({ userEmail, userName, role, properties, selectedPropertyId }: Props) {
  const displayName = userName || userEmail?.split("@")[0] || "User";

  return (
    <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 border-b border-gray-200">

      {/* ── Left: Logo + Property selector ───────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <span className="text-lg font-semibold tracking-tight text-gray-900 hidden sm:block">
          OmRent <span className="text-xs text-gray-400 font-normal">v1.0</span>
        </span>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-gray-200 mx-1" />

        {/* Property scope selector */}
        {properties.length > 0 && (
          <PropertySelector
            properties={properties}
            currentPropertyId={selectedPropertyId}
          />
        )}
      </div>

      {/* ── Right: notifications + user + logout ─────────────────── */}
      <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0">
        <button type="button" className="-m-2 p-2 text-gray-400 hover:text-gray-500 transition-colors">
          <span className="sr-only">View notifications</span>
          <BellIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="hidden lg:block h-5 w-px bg-gray-200" aria-hidden="true" />

        {/* Avatar + info */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white flex-shrink-0">
            {displayName[0].toUpperCase()}
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{displayName}</p>
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_BADGE[role]}`}>
              {ROLE_LABELS[role]}
            </span>
          </div>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
