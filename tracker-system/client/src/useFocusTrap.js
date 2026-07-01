// Trap Tab/Shift+Tab within an open dialog, restore focus on close.
import { useEffect } from "react";

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(ref, isOpen) {
  useEffect(() => {
    if (!isOpen || !ref.current) return;
    const node = ref.current;
    const trigger = document.activeElement;

    // focus first focusable
    const first = node.querySelector(FOCUSABLE);
    if (first) first.focus();

    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const items = node.querySelectorAll(FOCUSABLE);
      if (!items.length) return;
      const f = items[0], l = items[items.length - 1];
      if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); }
      else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (trigger && trigger.focus) try { trigger.focus(); } catch {}
    };
  }, [ref, isOpen]);
}
