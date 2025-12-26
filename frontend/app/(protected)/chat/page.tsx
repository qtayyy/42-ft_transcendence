"use client";

import { useState, useEffect, useRef } from "react";
import { useSocketContext } from "@/context/socket-context";
import { useAuth } from "@/hooks/use-auth";
import { useFriends } from '@/hooks/use-friends';
import { useLanguage } from '@/context/languageContext';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Users, UserPlus } from "lucide-react";

interface Message {
  id?: number;
  username: string;
  senderId?: number;
  message: string;
  timestamp: string;
}

interface Friend {
  id: string;
  username: string;
}

export default function ChatPage() {
  const { sendSocketMessage, isReady } = useSocketContext();
  const { user } = useAuth();
  const { friends, pending, loading: friendsLoading, error: friendsError } = useFriends();
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  // Prevent body scroll when chat page is mounted
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Load chat history when a friend is selected
  useEffect(() => {
    if (!selectedFriend) {
      setMessages([]);
      return;
    }

    const loadChatHistory = async () => {
      setLoadingHistory(true);
      try {
        const response = await fetch(`/api/chat/${selectedFriend.id}`);
        if (!response.ok) {
          throw new Error("Failed to load chat history");
        }
        const history = await response.json();
        setMessages(history || []);
      } catch (error) {
        console.error("Error loading chat history:", error);
        setMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, [selectedFriend]);

  // Listen for incoming messages
  useEffect(() => {
    const handleNewMessage = (event: CustomEvent) => {
      const data: Message = event.detail;
      
      // Only add message if it's from the selected friend or sent by current user to selected friend
      if (selectedFriend && data.senderId !== undefined) {
        const senderIdStr = data.senderId.toString();
        const currentUserIdStr = user?.id?.toString();
        
        // Message is from selected friend OR from current user (to selected friend)
        if (senderIdStr === selectedFriend.id || senderIdStr === currentUserIdStr) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some(msg => msg.id === data.id)) {
              return prev;
            }
            return [...prev, data];
          });
        }
      }
    };

    window.addEventListener("chatMessage", handleNewMessage as EventListener);
    return () => {
      window.removeEventListener("chatMessage", handleNewMessage as EventListener);
    };
  }, [selectedFriend, user]);

  // Handle friend selection
  const handleFriendClick = (friend: Friend) => {
    setSelectedFriend(friend);
  };

  // Send message
  const handleSend = () => {
    if (!inputValue.trim() || !isReady || !selectedFriend) return;

    const messageContent = inputValue.trim();
    const tempMessage: Message = {
      username: user?.username || t.chat.You,
      message: messageContent,
      timestamp: new Date().toISOString(),
    };

    // Optimistically add message to UI
    setMessages((prev) => [...prev, tempMessage]);

    // Send via WebSocket with recipient ID
    sendSocketMessage({
      event: "CHAT_MESSAGE",
      payload: {
        message: messageContent,
        recipientId: parseInt(selectedFriend.id),
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-card flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t.Dashboard.Friends}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</p>
        </div>

        {/* Friends List - Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {friendsLoading ? (
            <div className="p-4 text-center text-muted-foreground">{t.chat.loading}</div>
          ) : friendsError ? (
            <div className="p-4 text-center text-destructive">{friendsError}</div>
          ) : (
            <div className="p-2">
              {friends.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  {t.chat["No friends"]}
                </div>
              ) : (
                friends.map(friend => (
                  <div
                    key={friend.id}
                    onClick={() => handleFriendClick(friend)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all mb-1 ${
                      selectedFriend?.id === friend.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                      selectedFriend?.id === friend.id
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-primary/20 text-primary"
                    }`}>
                      {friend.username[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        selectedFriend?.id === friend.id ? "text-primary-foreground" : ""
                      }`}>
                        {friend.username}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Pending Requests Section */}
        {pending.length > 0 && (
          <div className="border-t border-border">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{t.chat["Pending Requests"]}</h3>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {pending.length}
                </span>
              </div>
            </div>
            <div className="p-2 max-h-40 overflow-y-auto scrollbar-hide">
              {pending.map(req => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-2 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                >
                  <div className="w-8 h-8 rounded-full bg-muted-foreground/30 flex items-center justify-center text-xs font-semibold shrink-0">
                    {req.requester.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{req.requester.username}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFriend ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-border bg-card flex items-center px-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold">
                  {selectedFriend.username[0]?.toUpperCase()}
                </div>
                <div>
                  <h1 className="font-semibold text-lg">{selectedFriend.username}</h1>
                  {isReady ? (
                    <p className="text-xs text-muted-foreground">Online</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.chat["Connecting to chat..."]}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Display - Scrollable */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto bg-muted/30 p-4 scrollbar-hide"
            >
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">{t.chat.loading}...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <span className="text-2xl">💬</span>
                  </div>
                  <p className="text-muted-foreground text-center">
                    {t.chat["No messages yet. Start chatting!"]}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {messages.map((msg, idx) => {
                    const isOwnMessage = msg.senderId?.toString() === user?.id?.toString();
                    const showAvatar = idx === 0 || messages[idx - 1]?.senderId !== msg.senderId;
                    const time = new Date(msg.timestamp);
                    const showDate = idx === 0 || 
                      new Date(messages[idx - 1].timestamp).toDateString() !== time.toDateString();
                    
                    return (
                      <div key={`${msg.id ?? "local"}-${idx}`}>
                        {showDate && (
                          <div className="flex items-center justify-center my-4">
                            <span className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full">
                              {time.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                        <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isOwnMessage && (
                            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                              {showAvatar ? msg.username[0]?.toUpperCase() : ''}
                            </div>
                          )}
                          <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
                            {showAvatar && !isOwnMessage && (
                              <span className="text-xs font-medium text-muted-foreground mb-1 px-1">
                                {msg.username}
                              </span>
                            )}
                            <div
                              className={`rounded-2xl px-4 py-2 shadow-sm ${
                                isOwnMessage
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-card border border-border rounded-bl-sm"
                              }`}
                            >
                              <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                            </div>
                            <span className={`text-xs text-muted-foreground mt-1 px-1 ${
                              isOwnMessage ? 'text-right' : 'text-left'
                            }`}>
                              {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area - Fixed at bottom */}
            <div className="border-t border-border bg-card p-4 shrink-0">
              <div className="flex gap-2 max-w-4xl mx-auto">
                <Input
                  type="text"
                  placeholder={t.chat["Type a message..."]}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={!isReady}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || !isReady}
                  size="default"
                  className="shrink-0"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {t.chat.Send}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Select a friend to start chatting</h2>
              <p className="text-muted-foreground">
                Choose someone from your friends list to begin a conversation
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
