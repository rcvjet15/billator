"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker on the client. Service workers only work in
 * a secure context (HTTPS) or on localhost; registration is skipped otherwise.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.isSecureContext === false) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => undefined)
      .catch((err) => {
        console.error("[pwa] service worker registration failed", err);
      });
  }, []);

  return null;
}
