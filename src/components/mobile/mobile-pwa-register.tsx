"use client";

import { useEffect } from "react";

export function MobilePwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/mobile-sw.js", { scope: "/mobile" });
  }, []);
  return null;
}
