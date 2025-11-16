"use client";

import { useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");

  return (
    <main className="w-full max-w-md px-4">
      <div className="chat-card space-y-4">
        <h1 className="text-2xl font-semibold">PWA Chat</h1>
        <p className="text-sm text-slate-300">
          Enter a nickname and join the chat room. This demo uses Firestore for
          realtime messages and works as a basic PWA.
        </p>

        <input
          className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none border border-slate-700 focus:border-sky-500"
          placeholder="Your nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Link
          href={name ? `/chat?name=${encodeURIComponent(name)}` : "#"}
          className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition ${
            name
              ? "bg-sky-600 hover:bg-sky-500 text-white"
              : "bg-slate-700 text-slate-400 cursor-not-allowed"
          }`}
          aria-disabled={!name}
        >
          Join chat
        </Link>

        <p className="text-xs text-slate-500">
          Tip: install this as an app from your browser menu to use it like a
          PWA.
        </p>
      </div>
    </main>
  );
}
