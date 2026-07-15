import { BellIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { logout } from "@/app/login/actions";
import { type Role } from "@/lib/permissions";
import { Badge, getUserRoleBadge } from "@/components/ui";
import PropertySelector from "./PropertySelector";
import GlobalSearch from "./GlobalSearch";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface Props {
  userEmail:         string | undefined;
  userName:          string | null | undefined;
  role:              Role;
  /** Display name of the user's assigned role (custom or system). */
  roleName?:         string | null;
  /** True when the assigned role is a custom (non-system) role. */
  isCustomRole?:     boolean;
  properties:        { id: string; name: string }[];
  selectedPropertyId: string;
}

export default async function Header({ userEmail, userName, role, roleName, isCustomRole, properties, selectedPropertyId }: Props) {
  const displayName = userName || userEmail?.split("@")[0] || "User";
  const t      = await getTranslations("dashboard.header");
  const tRoles = await getTranslations("settings.roles");
  // Custom roles show their own name as-is; system/enum roles use the localized label.
  const roleLabel = isCustomRole && roleName ? roleName : tRoles(role);

  return (
    <div className="flex h-16 items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 lg:px-8 border-b border-gray-200 min-w-0">

      {/* ── Start: Logo + Property selector ───────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Binaya logo — mark on mobile, full wordmark on md+ */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/binaya-mark.svg" alt="Binaya" className="h-7 w-7 md:hidden flex-shrink-0" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/binaya-logo-horizontal.svg" alt="Binaya" className="hidden md:block h-7 w-auto" />

        {/* Divider */}
        <div className="hidden md:block h-5 w-px bg-gray-200 mx-1" />

        {/* Property scope selector */}
        {properties.length > 0 && (
          <div className="min-w-0 flex-shrink">
            <PropertySelector
              properties={properties}
              currentPropertyId={selectedPropertyId}
            />
          </div>
        )}
      </div>

      {/* ── Middle: global command-palette search ─────────────── */}
      <div className="flex flex-1 justify-center px-1 sm:px-4">
        <GlobalSearch />
      </div>

      {/* ── End: notifications + language + user + logout ─────── */}
      <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 flex-shrink-0">
        <button
          type="button"
          className="-m-2 p-2 text-gray-400 hover:text-gray-500 transition-colors hidden sm:inline-flex"
        >
          <span className="sr-only">{t("viewNotifications")}</span>
          <BellIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        <LanguageSwitcher />

        <div className="hidden lg:block h-5 w-px bg-gray-200" aria-hidden="true" />

        {/* User: name always; avatar + role on desktop only */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden sm:flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white flex-shrink-0">
            {displayName[0].toUpperCase()}
          </div>
          <div className="text-end min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight truncate max-w-[110px] sm:max-w-[160px]">{displayName}</p>
            <div className="hidden sm:block">
              <Badge {...getUserRoleBadge(role)} size="sm">
                {roleLabel}
              </Badge>
            </div>
          </div>
        </div>

        <form action={logout}>
          <button
            type="submit"
            aria-label={t("logout")}
            className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 sm:px-3 py-2 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4 rtl:rotate-180" />
            <span className="hidden sm:inline">{t("logout")}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
