"use client";

import { useEffect } from "react";

type FrappeEmbedModeProps = {
  /** Hide Vercel sidebar + topbar so proxied Frappe desk fills the viewport. */
  fullBleed?: boolean;
};

/** Hides Vercel chrome so proxied Frappe desk fills the main pane. */
export function FrappeEmbedMode({ fullBleed = false }: FrappeEmbedModeProps) {
  useEffect(() => {
    document.documentElement.classList.add("desk-embed-mode");
    if (fullBleed) {
      document.documentElement.classList.add("desk-embed-fullbleed");
    }
    return () => {
      document.documentElement.classList.remove("desk-embed-mode");
      document.documentElement.classList.remove("desk-embed-fullbleed");
    };
  }, [fullBleed]);
  return null;
}
