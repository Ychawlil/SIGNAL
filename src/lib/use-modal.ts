"use client";
import { useEffect, useRef } from "react";
let locks = 0;
let previousOverflow = "";
export function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (locks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    const root = ref.current;
    const focusable = () => Array.from(root?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]') ?? []).filter((el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0);
    (root?.querySelector<HTMLElement>("input") ?? focusable()[0] ?? root)?.focus();
    const key = (event: KeyboardEvent) => {
      if (document.querySelectorAll('[aria-modal="true"]')[document.querySelectorAll('[aria-modal="true"]').length - 1] !== root) return;
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key === "Tab") {
        const elements = focusable(); const first = elements[0]; const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); root?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !root?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); if (--locks === 0) document.body.style.overflow = previousOverflow; if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return ref;
}
