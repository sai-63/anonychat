"use client";

import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    // You could log choiceResult.outcome if you care
    setDeferredPrompt(null);
    setShow(false);
  }

  return (
    <button
      onClick={handleInstall}
      className="text-xs px-3 py-1 rounded-full border border-sky-500 text-sky-300 hover:bg-sky-950/50"
    >
      Install app
    </button>
  );
}
