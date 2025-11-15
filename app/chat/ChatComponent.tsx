'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import InstallPrompt from '../../components/InstallPrompt';

type ChatMessage = {
  id: string;
  text: string;
  name: string;
  createdAt?: { seconds: number; nanoseconds: number };
};

export default function ChatComponent() {
  const searchParams = useSearchParams();
  const nameFromQuery = searchParams.get('name') || 'Anonymous';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // Listen to Firestore messages
  useEffect(() => {
    // Check if we're in browser environment
    if (typeof window === 'undefined') return;

    try {
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'));
      const unsub = onSnapshot(
        q, 
        (snap) => {
          const msgs: ChatMessage[] = [];
          snap.forEach((doc) => {
            const data = doc.data() as any;
            msgs.push({
              id: doc.id,
              text: data.text,
              name: data.name,
              createdAt: data.createdAt,
            });
          });
          setMessages(msgs);
          setIsConnected(true);
        },
        (error) => {
          console.error('Firestore error:', error);
          setIsConnected(false);
        }
      );

      return () => unsub();
    } catch (error) {
      console.error('Failed to connect to Firestore:', error);
      setIsConnected(false);
    }
  }, []);

  // Send message
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');

    try {
      await addDoc(collection(db, 'messages'), {
        text,
        name: nameFromQuery,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  }

  // Sort messages by timestamp
  const sortedMessages = useMemo(
    () =>
      [...messages].sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return (
          a.createdAt.seconds - b.createdAt.seconds ||
          a.createdAt.nanoseconds - b.createdAt.nanoseconds
        );
      }),
    [messages]
  );

  return (
    <main className="w-full max-w-md px-4">
      <div className="chat-card flex flex-col h-[80vh]">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold">Global Chat</h1>
            <p className="text-xs text-slate-400">
              Signed in as <span className="font-mono">{nameFromQuery}</span>
            </p>
            {!isConnected && messages.length === 0 && (
              <p className="text-xs text-yellow-500 mt-1">
                Connecting to chat...
              </p>
            )}
          </div>
          <InstallPrompt />
        </header>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2">
          {!isConnected && messages.length === 0 ? (
            <div className="text-center mt-8">
              <p className="text-sm text-slate-500">Connecting to chat server...</p>
            </div>
          ) : sortedMessages.length === 0 ? (
            <p className="text-xs text-slate-500 text-center mt-4">
              No messages yet. Say hi 👋
            </p>
          ) : (
            sortedMessages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.name === nameFromQuery
                    ? 'ml-auto bg-sky-600 text-white rounded-br-none'
                    : 'mr-auto bg-slate-800 text-slate-50 rounded-bl-none'
                }`}
              >
                <p className="text-[10px] opacity-70 mb-0.5">{m.name}</p>
                <p>{m.text}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={sendMessage} className="mt-2 flex gap-2">
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
            className="rounded-xl bg-sky-600 hover:bg-sky-500 px-3 py-2 text-sm font-medium disabled:bg-slate-600 disabled:cursor-not-allowed"
            disabled={!isConnected || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}