"use client";

import { useState, useEffect } from "react";
import { useSocketContext } from "@/context/socket-context";
import { useAuth } from "@/hooks/use-auth";
import { useFriends } from '@/hooks/use-friends';

export default function ChatPage() {
  const { sendSocketMessage, isReady } = useSocketContext();
  const { user } = useAuth();
  const { friends, pending, loading: friendsLoading, error: friendsError } = useFriends();
  const [messages, setMessages] = useState<Array<{username: string, message: string, timestamp: string}>>([]);
  const [inputValue, setInputValue] = useState("");

  // Listen for incoming messages
  useEffect(() => {
    const handleNewMessage = (event: CustomEvent) => {
      const data = event.detail;
      setMessages((prev) => [...prev, data]);
    };

    window.addEventListener("chatMessage", handleNewMessage as EventListener);
    return () => {
      window.removeEventListener("chatMessage", handleNewMessage as EventListener);
    };
  }, []);

  // Send message
  const handleSend = () => {
    if (!inputValue.trim() || !isReady) return;

    // Add your own message to UI
    setMessages((prev) => [
      ...prev,
      {
        username: user?.username || "You",
        message: inputValue.trim(),
        timestamp: new Date().toISOString(),
      },
    ]);

    // Send via WebSocket
    sendSocketMessage({
      event: "CHAT_MESSAGE",
      payload: {
        message: inputValue.trim(),
      },
    });

    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-muted text-foreground p-6 flex flex-col items-start">
        <h2 className="text-xl font-semibold mb-4">Friends ({friends.length})</h2>
        {friendsLoading ? (
          <div>Loading friends...</div>
        ) : friendsError ? (
          <div className="text-red-500">{friendsError}</div>
        ) : (
          <ul className="list-none p-0 w-full">
            {friends.map(friend => (
              <li key={friend.id} className="flex items-center mb-3 cursor-pointer bg-card rounded px-3 py-2 w-full">
                <div className="w-8 h-8 rounded-full bg-muted-foreground mr-3 flex items-center justify-center text-background font-bold">
                  {friend.username[0]?.toUpperCase()}
                </div>
                <span>{friend.username}</span>
              </li>
            ))}
            {friends.length === 0 && <li className="text-muted-foreground">No friends</li>}
          </ul>
        )}
        <h3 className="text-base font-medium mt-8 mb-2">Pending Requests ({pending.length})</h3>
        <ul className="list-none p-0 w-full">
          {pending.map(req => (
            <li key={req.id} className="flex items-center mb-3 bg-muted-foreground/50 rounded px-3 py-2 opacity-70 w-full">
              <div className="w-8 h-8 rounded-full bg-muted-foreground mr-3 flex items-center justify-center text-background font-bold">
                {req.requester.username[0]?.toUpperCase()}
              </div>
              <span>{req.requester.username}</span>
              <span className="ml-2 text-xs text-muted-foreground">(pending)</span>
            </li>
          ))}
          {pending.length === 0 && <li className="text-muted-foreground">No pending requests</li>}
        </ul>
      </aside>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="container mx-auto p-8 max-w-4xl w-full">
          <h1 className="text-3xl font-bold mb-6">Simple Chat</h1>
          {/* Messages Display */}
          <div className="bg-card border rounded-lg p-4 mb-4">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-center mt-10">
                No messages yet. Start chatting! 💬
              </p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, idx) => (
                  <div key={idx} className="p-3 bg-muted rounded">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm">{msg.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Input Area */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-4 py-2 border rounded-lg bg-background"
              disabled={!isReady}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || !isReady}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
            >
              Send
            </button>
          </div>
          {!isReady && (
            <p className="text-sm text-muted-foreground mt-2">
              Connecting to chat...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
