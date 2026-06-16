"use client";

import { createContext, useContext } from "react";
import { atLeast, type PermissionMap, type PermissionLevel } from "@/lib/rbac";

interface PermCtx {
  perms: PermissionMap;
  isOwner: boolean;
}

const Ctx = createContext<PermCtx>({ perms: {}, isOwner: false });

/** Provides the current user's effective permission matrix to client components. */
export function PermissionsProvider({
  perms,
  isOwner,
  children,
}: {
  perms: PermissionMap;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ perms, isOwner }}>{children}</Ctx.Provider>;
}

/** True if the current user has at least `level` on `entity` (owner always true). */
export function useCan(entity: string, level: PermissionLevel = "VIEW"): boolean {
  const { perms, isOwner } = useContext(Ctx);
  return isOwner || atLeast(perms, entity, level);
}
