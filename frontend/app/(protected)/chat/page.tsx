"use client";

import { useState, useEffect, useRef } from "react";
import { useSocketContext } from "@/context/socket-context";
import { useAuth } from "@/hooks/use-auth";
import { useFriends, type Friend } from '@/hooks/use-friends';
import { useGame } from '@/hooks/use-game';
import { useLanguage } from '@/context/languageContext';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Send, Users, UserPlus } from "lucide-react";

interface Message {
  id?: number;
  username: string;
  senderId?: number;
  avatar?: string | null;
  message: string;
  timestamp: string;
}

export default function ChatPage() {
  const { sendSocketMessage, isReady } = useSocketContext();
  const { user } = useAuth();
  const { friends, pending, loading: friendsLoading, error: friendsError } = useFriends();
  const { onlineFriends } = useGame();
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    
    // Store original overflow values
    const originalBodyOverflow = body.style.overflow;
    const originalHtmlOverflow = html.style.overflow;
    
    // Prevent scrolling on body and html
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    
    // Calculate header height and position chat container below it
    const updateChatPosition = () => {
      if (chatContainerRef.current) {
        // Find the header element by looking for fixed top-0 element
        const allDivs = Array.from(document.querySelectorAll('div'));
        const header = allDivs.find(
          el => {
            const classes = el.className || '';
            return classes.includes('fixed') && 
                   classes.includes('top-0') && 
                   (classes.includes('z-50') || classes.includes('z-40'));
          }
        ) as HTMLElement | undefined;
        
        if (header) {
          const headerHeight = header.offsetHeight;
          // Add small buffer to prevent overlap
          chatContainerRef.current.style.top = `${headerHeight + 4}px`;
        } else {
          // Fallback: use pt-28 value (112px) from protected layout plus small buffer
          // Header logo (90px) + padding (12px top) ≈ 102px, but protected layout uses 112px
          chatContainerRef.current.style.top = '116px';
        }
      }
    };
    
    // Update position on mount and window resize
    updateChatPosition();
    window.addEventListener('resize', updateChatPosition);
    
    return () => {
      // Restore original overflow values
      body.style.overflow = originalBodyOverflow;
      html.style.overflow = originalHtmlOverflow;
      window.removeEventListener('resize', updateChatPosition);
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      
      // Only auto-scroll if user is already near the bottom
      if (isNearBottom) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 0);
      }
    }
  }, [messages]);

  // Scroll to bottom when friend changes or history loads
  useEffect(() => {
    if (messagesContainerRef.current && selectedFriend && !loadingHistory) {
      // Small delay to ensure messages are rendered
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [selectedFriend, loadingHistory]);

  // Load chat history when a friend is selected
  useEffect(() => {
    if (!selectedFriend) {
      setMessages([]);
      return;
    }

    const loadChatHistory = async () => {
      if (!selectedFriend?.id) {
        console.error("No friend selected or friend ID is missing");
        setMessages([]);
        setLoadingHistory(false);
        return;
      }
      
      setLoadingHistory(true);
      try {
        const friendId = selectedFriend.id.toString();
        console.log("Loading chat history for friend:", friendId);
        const response = await fetch(`/api/chat/${friendId}`);
        if (!response.ok) {
          // Try to get error message from response
          let errorMessage = "Failed to load chat history";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If response is not JSON, use status text
            errorMessage = response.statusText || errorMessage;
          }
          console.error("Error loading chat history:", {
            status: response.status,
            statusText: response.statusText,
            friendId: selectedFriend.id,
            error: errorMessage
          });
          throw new Error(errorMessage);
        }
        const history = await response.json();
        setMessages(history || []);
      } catch (error) {
        console.error("Error loading chat history:", error);
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
      console.log("Chat page received message event:", data, "selectedFriend:", selectedFriend?.id);
      
      // Must have senderId to process
      if (data.senderId === undefined) return;
      
      const senderIdStr = data.senderId.toString();
      const currentUserIdStr = user?.id?.toString();
      
      // Only process messages if we have a selected friend (chat is open)
      if (selectedFriend) {
        const selectedFriendIdStr = selectedFriend.id.toString();
        
        // Check if message is relevant to current conversation:
        // 1. Message from selected friend (to current user) - always show
        // 2. Message from current user (confirming our sent message) - show if for this conversation
        const isFromSelectedFriend = senderIdStr === selectedFriendIdStr;
        const isFromCurrentUser = senderIdStr === currentUserIdStr;
        
        // Only show messages in current conversation
        if (isFromSelectedFriend || isFromCurrentUser) {
          setMessages((prev) => {
            // Avoid duplicates by ID
            if (data.id && prev.some(msg => msg.id === data.id)) {
              return prev;
            }
            
            // If this is a saved message from current user, replace optimistic message without ID
            if (isFromCurrentUser && data.id) {
              // Find and replace optimistic message (same content, no ID, recent timestamp)
              const optimisticIndex = prev.findIndex(msg => 
                !msg.id && 
                msg.senderId === data.senderId && 
                msg.message === data.message &&
                Math.abs(new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()) < 5000 // within 5 seconds
              );
              
              if (optimisticIndex !== -1) {
                // Replace optimistic message with saved one
                const updated = [...prev];
                updated[optimisticIndex] = data;
                return updated;
              }
            }
            
            // Otherwise, add new message
            return [...prev, data];
          });
        }
      }
      // If no friend is selected, we still receive the message but don't display it
      // It will be loaded when the user selects that friend's chat
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
      senderId: user?.id ? parseInt(user.id) : undefined,
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
    
    // Always scroll to bottom when user sends a message
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 0);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div 
      ref={chatContainerRef}
      className="fixed left-0 right-0 flex bg-background overflow-hidden" 
      style={{ 
        top: '116px', // Default: Account for header (pt-28 = 112px) + small buffer, will be updated dynamically
        bottom: '24px', // Add spacing from bottom of viewport to lift input bar
        width: '100vw' 
      }}
    >
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-card flex flex-col shrink-0 overflow-hidden h-full">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t.Dashboard.Friends}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</p>
        </div>

        {/* Friends List - Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
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
                    <Avatar className="w-10 h-10 shrink-0">
                      {friend.avatar ? (
                        <AvatarImage src={friend.avatar} alt={friend.username} />
                      ) : null}
                      <AvatarFallback className={`font-semibold text-sm ${
                        selectedFriend?.id === friend.id
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/20 text-primary"
                      }`}>
                        {friend.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ height: '100%' }}>
        {selectedFriend ? (
          <>
            {/* Chat Header - Fixed at top */}
            <div className="h-16 border-b border-border bg-card flex items-center px-6 shrink-0 z-10">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  {selectedFriend.avatar ? (
                    <AvatarImage src={selectedFriend.avatar} alt={selectedFriend.username} />
                  ) : null}
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                    {selectedFriend.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="font-semibold text-lg">{selectedFriend.username}</h1>
                  {isReady ? (
                    <div className="flex items-center gap-1.5">
                      {onlineFriends.some(f => Number(f.id) === Number(selectedFriend.id)) ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <p className="text-xs text-muted-foreground">Online</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Offline</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.chat["Connecting to chat..."]}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Display - Scrollable container with fixed height */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto bg-muted/30 p-4 scrollbar-hide min-h-0"
              style={{ scrollBehavior: 'smooth' }}
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
                <div className="space-y-4 max-w-4xl mx-auto pb-2">
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
                            <Avatar className="w-8 h-8 shrink-0">
                              {msg.avatar ? (
                                <AvatarImage src={msg.avatar} alt={msg.username} />
                              ) : null}
                              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                                {msg.username[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
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

            {/* Input Area - Fixed at bottom with spacing */}
            <div className="border-t border-border bg-card px-4 py-4 shrink-0 z-10">
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
          <div className="flex-1 flex items-center justify-center overflow-hidden">
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
