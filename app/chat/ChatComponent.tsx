"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  MouseEvent,
  FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import InstallPrompt from "../../components/InstallPrompt";

type FirestoreTimestamp = { seconds: number; nanoseconds: number };

type ChatMessage = {
  id: string;
  text: string;
  name: string;
  createdAt?: FirestoreTimestamp;
  replyToId?: string | null;
  deletedForEveryone?: boolean;
  editedAt?: FirestoreTimestamp;
};

type RoomAccessState = {
  loading: boolean;
  allowed: boolean;
  error: string | null;
};

export default function ChatPage() {
  const searchParams = useSearchParams();
  const nameFromQuery = searchParams.get("name") || "Anonymous";
  const roomFromQuery = searchParams.get("room") || "";
  const passkeyFromQuery = searchParams.get("passkey") || "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [roomAccess, setRoomAccess] = useState<RoomAccessState>({
    loading: true,
    allowed: false,
    error: null,
  });

  // Reply / edit state
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  // "Delete for me" – hidden IDs stored locally
  const [hiddenForMe, setHiddenForMe] = useState<Set<string>>(new Set());

  // Scrolling helpers
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // ---------- Helpers ----------

  function tsToHHMM(ts?: FirestoreTimestamp): string {
    if (!ts) return "";
    const date = new Date(ts.seconds * 1000 + ts.nanoseconds / 1e6);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Map id -> message (for reply preview)
  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  // Hide messages that are "deleted for me"
  const visibleMessages = useMemo(
    () => messages.filter((m) => !hiddenForMe.has(m.id)),
    [messages, hiddenForMe]
  );

  // Sort by createdAt
  const sortedMessages = useMemo(
    () =>
      [...visibleMessages].sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return (
          a.createdAt.seconds - b.createdAt.seconds ||
          a.createdAt.nanoseconds - b.createdAt.nanoseconds
        );
      }),
    [visibleMessages]
  );

  const storageKey = `hidden_${roomFromQuery}_${nameFromQuery}`;

  // Load "delete for me" from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const arr: string[] = JSON.parse(raw);
      setHiddenForMe(new Set(arr));
    } catch {
      // ignore
    }
  }, [storageKey]);

  function persistHidden(set: Set<string>) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(set)));
  }

  // ---------- 1) Check / create room & validate passkey ----------

  useEffect(() => {
    if (!roomFromQuery) {
      setRoomAccess({
        loading: false,
        allowed: false,
        error: "No room specified.",
      });
      return;
    }

    let cancelled = false;

    async function checkRoom() {
      try {
        const roomRef = doc(db, "rooms", roomFromQuery);
        const snap = await getDoc(roomRef);

        if (!snap.exists()) {
          // First user creates this room
          await setDoc(roomRef, {
            hasPasskey: !!passkeyFromQuery,
            passkey: passkeyFromQuery || null,
            createdAt: serverTimestamp(),
          });

          if (!cancelled) {
            setRoomAccess({ loading: false, allowed: true, error: null });
          }
          return;
        }

        const data = snap.data() as any;
        const hasPasskey = !!data.hasPasskey && !!data.passkey;

        if (!hasPasskey) {
          if (!cancelled) {
            setRoomAccess({ loading: false, allowed: true, error: null });
          }
          return;
        }

        if (passkeyFromQuery && passkeyFromQuery === data.passkey) {
          if (!cancelled) {
            setRoomAccess({ loading: false, allowed: true, error: null });
          }
        } else {
          if (!cancelled) {
            setRoomAccess({
              loading: false,
              allowed: false,
              error:
                "This room is protected by a passkey. You must join with the correct passkey.",
            });
          }
        }
      } catch (error) {
        console.error("Failed to validate room:", error);
        if (!cancelled) {
          setRoomAccess({
            loading: false,
            allowed: false,
            error: "Failed to validate room. Please try again.",
          });
        }
      }
    }

    checkRoom();
    return () => {
      cancelled = true;
    };
  }, [roomFromQuery, passkeyFromQuery, db]);

  // ---------- 2) Listen to messages (only if roomAccess.allowed) ----------

  useEffect(() => {
    if (!roomAccess.allowed || !roomFromQuery) return;

    const msgsRef = collection(db, "rooms", roomFromQuery, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs: ChatMessage[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          msgs.push({
            id: docSnap.id,
            text: data.text,
            name: data.name,
            createdAt: data.createdAt,
            replyToId: data.replyToId || null,
            deletedForEveryone: !!data.deletedForEveryone,
            editedAt: data.editedAt,
          });
        });
        setMessages(msgs);
        setIsConnected(true);
      },
      (error) => {
        console.error("Firestore error:", error);
        setIsConnected(false);
      }
    );

    return () => unsub();
  }, [roomAccess.allowed, roomFromQuery, db]);

  // ---------- 3) Scroll behaviour (auto + scroll-to-bottom button) ----------

  // Update "near bottom" on scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    function handleScroll() {
      if (!el) return;
      const threshold = 80; // px
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom < threshold;
      setIsNearBottom(atBottom);
      setShowScrollDown(!atBottom);
    }

    el.addEventListener("scroll", handleScroll);
    handleScroll(); // initial
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto scroll when new messages arrive & user is at bottom OR it’s their own message
  useEffect(() => {
    if (!bottomRef.current) return;
    if (!sortedMessages.length) return;

    const last = sortedMessages[sortedMessages.length - 1];
    if (isNearBottom || last.name === nameFromQuery) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [sortedMessages, isNearBottom, nameFromQuery]);

  function scrollToBottom() {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  // ---------- 4) Actions: send / reply / edit / delete ----------

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !roomFromQuery || !roomAccess.allowed) return;
    setInput("");

    const msgsRef = collection(db, "rooms", roomFromQuery, "messages");

    try {
      if (editingMessage) {
        // EDIT existing message
        const msgRef = doc(msgsRef, editingMessage.id);
        await updateDoc(msgRef, {
          text,
          editedAt: serverTimestamp(),
        });
        setEditingMessage(null);
      } else {
        // NEW message
        await addDoc(msgsRef, {
          text,
          name: nameFromQuery,
          createdAt: serverTimestamp(),
          replyToId: replyTo?.id || null,
          deletedForEveryone: false,
        });
        setReplyTo(null);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    }
  }

  function handleReply(m: ChatMessage) {
    setReplyTo(m);
    setEditingMessage(null);
    setMenuOpenFor(null);
  }

  function handleEdit(m: ChatMessage) {
    if (m.name !== nameFromQuery) {
      alert("You can only edit your own messages.");
      return;
    }
    setEditingMessage(m);
    setReplyTo(null);
    setInput(m.text);
    setMenuOpenFor(null);
    scrollToBottom();
  }

  async function handleDeleteForEveryone(m: ChatMessage) {
    if (m.name !== nameFromQuery) {
      alert("You can only delete your own messages.");
      return;
    }
    if (!roomFromQuery) return;

    if (!confirm("Delete this message for everyone?")) return;

    try {
      const msgRef = doc(db, "rooms", roomFromQuery, "messages", m.id);
      await updateDoc(msgRef, {
        text: "This message was deleted",
        deletedForEveryone: true,
      });
      setMenuOpenFor(null);
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Failed to delete message.");
    }
  }

  function handleDeleteForMe(m: ChatMessage) {
    const next = new Set(hiddenForMe);
    next.add(m.id);
    setHiddenForMe(next);
    persistHidden(next);
    setMenuOpenFor(null);
  }

  function handleBubbleMenuClick(
    e: MouseEvent<HTMLButtonElement>,
    id: string
  ) {
    e.stopPropagation();
    setMenuOpenFor((prev) => (prev === id ? null : id));
  }

  function handleJumpToOriginal(replyToId?: string | null) {
    if (!replyToId) return;
    const el = document.getElementById(`msg-${replyToId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-sky-500");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-sky-500");
    }, 1200);
  }

  // ---------- 5) Render states (room loading / denied) ----------

  if (roomAccess.loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="chat-card w-full max-w-md flex flex-col items-center justify-center">
          <p className="text-sm text-slate-400">Checking room access…</p>
        </div>
      </main>
    );
  }

  if (!roomAccess.allowed) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="chat-card w-full max-w-md flex flex-col items-center justify-center space-y-3">
          <h1 className="text-lg font-semibold">Cannot join room</h1>
          <p className="text-sm text-red-400 text-center">
            {roomAccess.error ||
              "You are not allowed to join this room. Check the passkey and try again."}
          </p>
        </div>
      </main>
    );
  }

  // ---------- 6) Main chat UI (desktop-friendly) ----------

  return (
    <main className="min-h-screen bg-slate-950 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col border-x border-slate-800 bg-slate-950/90">
        {/* Header */}
        <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">
              Room:{" "}
              <span className="font-mono text-sky-400">{roomFromQuery}</span>
            </h1>
            <p className="text-xs text-slate-400">
              Signed in as <span className="font-mono">{nameFromQuery}</span>
            </p>
            {!isConnected && sortedMessages.length === 0 && (
              <p className="text-xs text-yellow-500 mt-1">
                Connecting to chat…
              </p>
            )}
          </div>
          <InstallPrompt />
        </header>

        {/* Messages area */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={listRef}
            className="h-full overflow-y-auto px-3 sm:px-6 py-4 space-y-2"
          >
            {!isConnected && sortedMessages.length === 0 ? (
              <div className="text-center mt-20">
                <p className="text-sm text-slate-500">
                  Connecting to chat server...
                </p>
              </div>
            ) : sortedMessages.length === 0 ? (
              <p className="text-xs text-slate-500 text-center mt-10">
                No messages yet. Say hi 👋
              </p>
            ) : (
              sortedMessages.map((m) => {
                const isMine = m.name === nameFromQuery;
                const replied = m.replyToId ? messageMap.get(m.replyToId) : null;

                return (
                  <div
                    key={m.id}
                    id={`msg-${m.id}`}
                    className={`flex w-full ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`relative max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-md ${
                        m.deletedForEveryone
                          ? "bg-slate-800 text-slate-400 italic"
                          : isMine
                          ? "bg-sky-600 text-white rounded-br-none"
                          : "bg-slate-800 text-slate-50 rounded-bl-none"
                      }`}
                    >
                      {/* three-dot menu */}
                      {!m.deletedForEveryone && (
                        <button
                          onClick={(e) => handleBubbleMenuClick(e, m.id)}
                          className="absolute -top-2 right-1 text-xs text-slate-200/70 hover:text-white"
                        >
                          ⋮
                        </button>
                      )}

                      {menuOpenFor === m.id && !m.deletedForEveryone && (
                        <div
                          className={`absolute z-20 mt-1 min-w-[140px] rounded-xl border border-slate-700 bg-slate-900 text-xs shadow-lg ${
                            isMine ? "right-0 top-5" : "left-0 top-5"
                          }`}
                        >
                          <button
                            className="block w-full px-3 py-2 text-left hover:bg-slate-800"
                            onClick={() => handleReply(m)}
                          >
                            Reply
                          </button>
                          {isMine && (
                            <button
                              className="block w-full px-3 py-2 text-left hover:bg-slate-800"
                              onClick={() => handleEdit(m)}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            className="block w-full px-3 py-2 text-left hover:bg-slate-800"
                            onClick={() => handleDeleteForMe(m)}
                          >
                            Delete for me
                          </button>
                          {isMine && (
                            <button
                              className="block w-full px-3 py-2 text-left text-red-400 hover:bg-slate-800"
                              onClick={() => handleDeleteForEveryone(m)}
                            >
                              Delete for everyone
                            </button>
                          )}
                        </div>
                      )}

                      {/* Reply preview */}
                      {replied && !m.deletedForEveryone && (
                        <button
                          type="button"
                          onClick={() => handleJumpToOriginal(m.replyToId)}
                          className={`mb-1 w-full text-left text-[11px] rounded-xl px-2 py-1 ${
                            isMine
                              ? "bg-sky-700/70"
                              : "bg-slate-900/70 border border-slate-700/80"
                          }`}
                        >
                          <p className="font-semibold opacity-80">
                            {replied.name}
                          </p>
                          <p className="line-clamp-1 opacity-80">
                            {replied.text}
                          </p>
                        </button>
                      )}

                      {/* Name + text */}
                      <p className="text-[10px] opacity-70 mb-0.5">
                        {m.name}
                        {m.editedAt && !m.deletedForEveryone && (
                          <span className="ml-1 italic opacity-60">
                            (edited)
                          </span>
                        )}
                      </p>
                      <p>{m.text}</p>

                      {/* Timestamp */}
                      <p className="mt-1 text-[10px] opacity-70 text-right">
                        {tsToHHMM(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Scroll-to-bottom button */}
          {showScrollDown && (
            <button
              onClick={scrollToBottom}
              className="absolute right-4 bottom-20 rounded-full bg-sky-600 hover:bg-sky-500 px-3 py-2 text-xs text-white shadow-lg"
            >
              ⬇ New messages
            </button>
          )}
        </div>

        {/* Reply / edit banner */}
        {(replyTo || editingMessage) && (
          <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-slate-200">
                {editingMessage ? "Editing message" : "Replying to"}
              </p>
              <p className="text-slate-400 line-clamp-1">
                {(editingMessage || replyTo)?.text}
              </p>
            </div>
            <button
              onClick={() => {
                setReplyTo(null);
                setEditingMessage(null);
                setMenuOpenFor(null);
              }}
              className="text-slate-400 hover:text-slate-200 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input area */}
        <form
          onSubmit={handleSubmit}
          className="px-4 py-3 border-t border-slate-800 flex gap-2 bg-slate-900"
        >
          <input
            type="text"
            className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none border border-slate-700 focus:border-sky-500"
            placeholder="Type a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!isConnected}
          />
          <button
            type="submit"
            className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-medium disabled:bg-slate-700 disabled:cursor-not-allowed"
            disabled={!isConnected || !input.trim()}
          >
            {editingMessage ? "Save" : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}
