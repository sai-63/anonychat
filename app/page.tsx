"use client";

import { useState } from "react";
import Link from "next/link";
import InstallPrompt from "../components/InstallPrompt";

export default function HomePage() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [passkey, setPasskey] = useState("");

  const canJoin = name.trim().length > 0 && room.trim().length > 0;

  // Build URL with passkey only if filled
  const href = canJoin
    ? `/chat?name=${encodeURIComponent(name)}&room=${encodeURIComponent(
        room
      )}${passkey.trim() ? `&passkey=${encodeURIComponent(passkey.trim())}` : ""}`
    : "#";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 chat-card">
        <h1 className="text-2xl font-semibold">Anonymous PWA Chat</h1>
        <p className="text-sm text-slate-300">
          Enter a nickname and a room name to join. Optional passkey can make
          the room private.
        </p>

        {/* Name */}
        <input
          className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none border border-slate-700 focus:border-sky-500"
          placeholder="Your nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Room */}
        <input
          className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none border border-slate-700 focus:border-sky-500"
          placeholder="Room name (e.g. general, friends, room-123)"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />

        {/* Optional passkey */}
        <input
          className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none border border-slate-700 focus:border-sky-500"
          placeholder="Optional passkey (to lock the room)"
          value={passkey}
          onChange={(e) => setPasskey(e.target.value)}
        />

        <Link
          href={href}
          className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition ${
            canJoin
              ? "bg-sky-600 hover:bg-sky-500 text-white"
              : "bg-slate-700 text-slate-400 cursor-not-allowed"
          }`}
          aria-disabled={!canJoin}
        >
          Join chat
        </Link>

        <p className="text-xs text-slate-500">
          Tip: install this as an app from your browser menu to use it like a
          PWA.
        </p>

        <div className="pt-2">
          <InstallPrompt />
        </div>
      </div>
    </main>
  );
}
