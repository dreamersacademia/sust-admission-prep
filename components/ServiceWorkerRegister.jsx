"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // best-effort — a failed registration just means "not installable
        // this time," never a broken app
      });
    }
  }, []);
  return null;
}