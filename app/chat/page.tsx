'use client';

import { Suspense } from 'react';
import ChatComponent from './ChatComponent';

export const dynamic = 'force-dynamic';

function ChatPageContent() {
  return <ChatComponent />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md px-4 py-8">Loading chat...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}