"use client";

import { useEffect } from "react";

/**
 * Vinext's client-side Link handler can fail before navigation is performed.
 * Use a regular browser navigation for internal links so the product remains
 * navigable even when the optional RSC prefetch layer is unavailable.
 */
export function NativeNavigationFallback() {
  useEffect(() => {
    function navigate(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const source = event.target;
      if (!(source instanceof Element)) return;
      const anchor = source.closest("a[href]");
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.href === window.location.href) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(destination.href);
    }

    document.addEventListener("click", navigate, true);
    return () => document.removeEventListener("click", navigate, true);
  }, []);

  return null;
}
