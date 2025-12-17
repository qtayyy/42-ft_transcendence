"use client";

import { useState, useEffect } from "react";
import { useSocketContext } from "@/context/socket-context";
import { useAuth } from "@/hooks/use-auth";

export default function ChatPage() {
  const { sendSocketMessage, isReady } = useSocketContext();
  const { user } = useAuth();
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
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Simple Chat</h1>

      {/* Messages Display */}
      <div className="bg-card border rounded-lg p-4 h-[500px] overflow-y-auto mb-4">
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
  );
}
