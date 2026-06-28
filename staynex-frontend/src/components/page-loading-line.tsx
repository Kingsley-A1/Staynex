"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MIN_VISIBLE_MS = 260;
const NAV_FALLBACK_MS = 6000;

export function PageLoadingLine() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const pendingFetches = useRef(0);
  const startedAt = useRef(0);
  const finishTimer = useRef<number | null>(null);
  const navFallbackTimer = useRef<number | null>(null);

  function clearTimer(timer: { current: number | null }) {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function show() {
    clearTimer(finishTimer);
    if (!startedAt.current) startedAt.current = Date.now();
    setVisible(true);
  }

  function finish() {
    if (pendingFetches.current > 0) return;
    const elapsed = startedAt.current
      ? Date.now() - startedAt.current
      : MIN_VISIBLE_MS;
    const delay = Math.max(80, MIN_VISIBLE_MS - elapsed);
    clearTimer(finishTimer);
    finishTimer.current = window.setTimeout(() => {
      setVisible(false);
      startedAt.current = 0;
    }, delay);
  }

  useEffect(() => {
    clearTimer(navFallbackTimer);
    finish();
  }, [pathname]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      pendingFetches.current += 1;
      show();
      try {
        return await originalFetch(...args);
      } finally {
        pendingFetches.current = Math.max(0, pendingFetches.current - 1);
        finish();
      }
    };

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!target || target.target || target.hasAttribute("download")) return;

      const nextUrl = new URL(target.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;

      const currentPath = `${window.location.pathname}${window.location.search}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      if (currentPath === nextPath && nextUrl.hash) return;

      show();
      clearTimer(navFallbackTimer);
      navFallbackTimer.current = window.setTimeout(finish, NAV_FALLBACK_MS);
    }

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.fetch = originalFetch;
      document.removeEventListener("click", handleDocumentClick, true);
      clearTimer(finishTimer);
      clearTimer(navFallbackTimer);
    };
  }, []);

  return (
    <div
      className={`page-loading-line${visible ? " is-visible" : ""}`}
      aria-hidden="true"
    >
      <span className="page-loading-line__bar" />
    </div>
  );
}
