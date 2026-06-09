"use client";

import { useCallback, useState } from "react";

/**
 * Manages open/close state for a single Modal instance.
 *
 *   const modal = useModal();
 *   <Button onClick={modal.open}>Open</Button>
 *   <Modal open={modal.isOpen} onClose={modal.close}>…</Modal>
 *
 * For programmatic "fire-and-forget" dialogs invoked from outside React
 * (action menus, command palettes), pair this with a context-based
 * dispatcher in a follow-up. ConfirmDialog will introduce that pattern.
 */
export function useModal(initial: boolean = false) {
  const [isOpen, setIsOpen] = useState(initial);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  return { isOpen, open, close, toggle, setIsOpen };
}
