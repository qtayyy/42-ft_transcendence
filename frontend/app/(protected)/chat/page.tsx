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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Send, Users, UserPlus, Search, MessageSquare, Smile, ChevronLeft, Zap, Ban, UserCircle, Gamepad2, MoreVertical, Check, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Message {
  id?: number;
  username: string;
  senderId?: number;
  avatar?: string | null;
  message: string;
  timestamp: string;
  read?: boolean;
  readAt?: string | null;
  type?: "text" | "game-invite" | "game-invite-sent" | "notification";
  meta?: {
    inviteType?: string;
    tournamentId?: string;
    roomId?: string;
    hostId?: number;
  };
}

export default function ChatPage() {
  const { sendSocketMessage, isReady } = useSocketContext();
  const { user } = useAuth();
  const { friends, pending, loading: friendsLoading, error: friendsError } = useFriends();
  const { onlineFriends, invitesReceived, setInvitesReceived } = useGame();
  const router = useRouter();
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [friendIsTyping, setFriendIsTyping] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useLanguage();

  const pushNotificationMessage = (text: string, meta: Message["meta"] = {}) => {
    setMessages((prev) => [
      ...prev,
      {
        username: "System",
        message: text,
        timestamp: new Date().toISOString(),
        type: "notification",
        meta,
      },
    ]);
  };

  // Load blocked users
  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        const response = await fetch('/api/chat/block');
        if (response.ok) {
          const data = await response.json();
          setBlockedUsers(data.map((u: any) => u.id));
        }
      } catch (error) {
        console.error("Error fetching blocked users:", error);
      }
    };
    fetchBlockedUsers();
  }, []);

  // Listen for typing indicators
  useEffect(() => {
    const handleTyping = (event: CustomEvent) => {
      const data = event.detail;
      if (selectedFriend && data.userId === parseInt(selectedFriend.id)) {
        setFriendIsTyping(data.isTyping);
        
        // Auto-clear typing indicator after 3 seconds
        if (data.isTyping) {
          setTimeout(() => setFriendIsTyping(false), 3000);
        }
      }
    };

    window.addEventListener("typingIndicator", handleTyping as EventListener);
    return () => {
      window.removeEventListener("typingIndicator", handleTyping as EventListener);
    };
  }, [selectedFriend]);

  // Listen for read receipts
  useEffect(() => {
    const handleReadReceipt = (event: CustomEvent) => {
      const data = event.detail;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, read: true, readAt: data.readAt }
            : msg
        )
      );
    };

    window.addEventListener("messageRead", handleReadReceipt as EventListener);
    return () => {
      window.removeEventListener("messageRead", handleReadReceipt as EventListener);
    };
  }, []);

  // Listen for chat-style game invite notifications.
  useEffect(() => {
    const handleGameInvite = (event: CustomEvent) => {
      const data = event.detail;
      const selectedFriendId = selectedFriend?.id ? parseInt(selectedFriend.id) : null;

      if (selectedFriendId && Number(data?.inviterId) === selectedFriendId) {
        setMessages((prev) => [
          ...prev,
          {
            username: data.inviterName || "Unknown",
            senderId: Number(data.inviterId),
            avatar: data.inviterAvatar || null,
            message: `${data.inviterName || "A friend"} invited you to play a game`,
            timestamp: data.timestamp || new Date().toISOString(),
            type: "game-invite",
            meta: {
              inviteType: data.inviteType || "normal",
              roomId: data.roomId,
              hostId: data.hostId ? Number(data.hostId) : undefined,
            },
          },
        ]);
        return;
      }

      pushNotificationMessage(`${data.inviterName || "A friend"} sent you a game invite`);
    };

    window.addEventListener("gameInvite", handleGameInvite as EventListener);
    return () => {
      window.removeEventListener("gameInvite", handleGameInvite as EventListener);
    };
  }, [selectedFriend]);

  // Mirror room-based invites into chat thread so user can accept/decline directly in chat.
  useEffect(() => {
    if (!selectedFriend) return;

    const roomInviteFromSelectedFriend = invitesReceived.find(
      (invite) => Number(invite.hostId) === Number(selectedFriend.id)
    );

    if (!roomInviteFromSelectedFriend) return;

    setMessages((prev) => {
      const alreadyExists = prev.some(
        (msg) =>
          msg.type === "game-invite" &&
          msg.meta?.roomId === roomInviteFromSelectedFriend.roomId
      );

      if (alreadyExists) return prev;

      return [
        ...prev,
        {
          username: roomInviteFromSelectedFriend.hostUsername,
          senderId: Number(roomInviteFromSelectedFriend.hostId),
          message: `${roomInviteFromSelectedFriend.hostUsername} invited you to join a private game room`,
          timestamp: new Date().toISOString(),
          type: "game-invite",
          meta: {
            inviteType: "room",
            roomId: roomInviteFromSelectedFriend.roomId,
            hostId: Number(roomInviteFromSelectedFriend.hostId),
          },
        },
      ];
    });
  }, [invitesReceived, selectedFriend]);

  // Listen for sent game invite acknowledgements and tournament events.
  useEffect(() => {
    const handleGameInviteSent = (event: CustomEvent) => {
      const data = event.detail;
      if (!selectedFriend?.id || Number(selectedFriend.id) !== Number(data?.recipientId)) {
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          username: user?.username || "You",
          senderId: user?.id ? parseInt(user.id) : undefined,
          message: `You invited ${selectedFriend.username} to play`,
          timestamp: new Date().toISOString(),
          type: "game-invite-sent",
          meta: {
            inviteType: data?.inviteType || "normal",
          },
        },
      ]);
    };

    const handleTournamentFound = (event: CustomEvent) => {
      const data = event.detail;
      pushNotificationMessage(
        `Tournament found (${data?.tournamentId || "pending id"}). Opening lobby...`,
        { tournamentId: data?.tournamentId }
      );
    };

    const handleTournamentStart = (event: CustomEvent) => {
      const data = event.detail;
      pushNotificationMessage(
        `Tournament started (${data?.tournamentId || "no id"}). Good luck!`,
        { tournamentId: data?.tournamentId }
      );
    };

    const handleTournamentPlayerLeft = () => {
      pushNotificationMessage("Tournament update: a player left the tournament.");
    };

    const handleTournamentUpdate = () => {
      pushNotificationMessage("Tournament standings were updated.");
    };

    window.addEventListener("gameInviteSent", handleGameInviteSent as EventListener);
    window.addEventListener("TOURNAMENT_FOUND", handleTournamentFound as EventListener);
    window.addEventListener("TOURNAMENT_START", handleTournamentStart as EventListener);
    window.addEventListener("tournamentPlayerLeft", handleTournamentPlayerLeft as EventListener);
    window.addEventListener("tournamentUpdate", handleTournamentUpdate as EventListener);

    return () => {
      window.removeEventListener("gameInviteSent", handleGameInviteSent as EventListener);
      window.removeEventListener("TOURNAMENT_FOUND", handleTournamentFound as EventListener);
      window.removeEventListener("TOURNAMENT_START", handleTournamentStart as EventListener);
      window.removeEventListener("tournamentPlayerLeft", handleTournamentPlayerLeft as EventListener);
      window.removeEventListener("tournamentUpdate", handleTournamentUpdate as EventListener);
    };
  }, [selectedFriend, user]);

  // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      
      if (isNearBottom) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 0);
      }
    }
  }, [messages]);

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
          let errorMessage = "Failed to load chat history";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);

    if (!selectedFriend || !isReady) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing indicator
    if (!isTyping && e.target.value.length > 0) {
      setIsTyping(true);
      sendSocketMessage({
        event: "TYPING_INDICATOR",
        payload: {
          recipientId: parseInt(selectedFriend.id),
          isTyping: true,
        },
      });
    }

    // Auto-stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendSocketMessage({
        event: "TYPING_INDICATOR",
        payload: {
          recipientId: parseInt(selectedFriend.id),
          isTyping: false,
        },
      });
    }, 2000);
  };

  // Mark messages as read when viewing them
  useEffect(() => {
    if (selectedFriend && messages.length > 0) {
      const unreadMessages = messages.filter(
        (msg) => !msg.read && msg.senderId !== user?.id && msg.id
      );

      unreadMessages.forEach((msg) => {
        if (msg.id) {
          sendSocketMessage({
            event: "MESSAGE_READ",
            payload: { messageId: msg.id },
          });
        }
      });
    }
  }, [messages, selectedFriend, user, sendSocketMessage]);

  // Block user
  const handleBlockUser = async () => {
    if (!selectedFriend) return;

    try {
      const response = await fetch('/api/chat/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedFriend.id }),
      });

      if (response.ok) {
        setBlockedUsers((prev) => [...prev, selectedFriend.id]);
        setSelectedFriend(null);
        setShowBlockDialog(false);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to block user");
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      alert("Failed to block user");
    }
  };

  // Unblock user
  const handleUnblockUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/chat/block/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setBlockedUsers((prev) => prev.filter((id) => id !== userId));
      } else {
        const error = await response.json();
        alert(error.error || "Failed to unblock user");
      }
    } catch (error) {
      console.error("Error unblocking user:", error);
      alert("Failed to unblock user");
    }
  };

  // Send room-based game invite from chat.
  const handleGameInvite = async () => {
    if (!selectedFriend || !isReady || !user?.id || !user?.username) return;

    try {
      const response = await fetch('/api/game/room/create?maxPlayers=2');
      if (!response.ok) {
        pushNotificationMessage("Failed to create room for invite.");
        return;
      }

      const data = await response.json();
      const roomId = data?.roomId;
      if (!roomId) {
        pushNotificationMessage("Room creation failed. Missing room id.");
        return;
      }

      sendSocketMessage({
        event: "SEND_GAME_INVITE",
        payload: {
          roomId,
          hostId: Number(user.id),
          hostUsername: user.username,
          friendId: Number(selectedFriend.id),
          friendUsername: selectedFriend.username,
        },
      });

      setMessages((prev) => [
        ...prev,
        {
          username: user.username,
          senderId: Number(user.id),
          message: `You invited ${selectedFriend.username} to room ${roomId}`,
          timestamp: new Date().toISOString(),
          type: "game-invite-sent",
          meta: { inviteType: "room", roomId, hostId: Number(user.id) },
        },
      ]);
    } catch (error) {
      console.error("Error sending room invite from chat:", error);
      pushNotificationMessage("Failed to send room invite.");
    }
  };

  const handleRespondInviteFromChat = (msg: Message, response: "accepted" | "rejected") => {
    const roomId = msg.meta?.roomId;
    const hostId = msg.meta?.hostId;

    if (!roomId || !hostId || !user?.id || !user?.username || !isReady) {
      pushNotificationMessage("Cannot respond to invite. Missing room details.");
      return;
    }

    sendSocketMessage({
      event: "RESPOND_INVITE",
      payload: {
        response,
        roomId,
        hostId,
        inviteeId: Number(user.id),
        inviteeUsername: user.username,
      },
    });

    setInvitesReceived((prev) => prev.filter((invite) => invite.roomId !== roomId));

    if (response === "accepted") {
      router.push(`/game/remote/single/join?roomId=${roomId}&invite=true`);
    }
  };

  const handleOpenRoomFromChat = (msg: Message) => {
    const roomId = msg.meta?.roomId;
    if (!roomId) {
      pushNotificationMessage("Missing room id for this invite.");
      return;
    }

    router.push(`/game/remote/single/create?roomId=${roomId}&fromChatInvite=true`);
  };

  const handleHostStartGameFromChat = (msg: Message) => {
    const roomId = msg.meta?.roomId;
    if (!roomId || !isReady) {
      pushNotificationMessage("Room is not ready to start yet.");
      return;
    }

    sendSocketMessage({
      event: "START_ROOM_GAME",
      payload: { roomId },
    });

    // Keep host in sync with room state if match cannot start immediately.
    router.push(`/game/remote/single/create?roomId=${roomId}&fromChatInvite=true`);
  };

  // View profile
  const handleViewProfile = () => {
    if (selectedFriend) {
      router.push(`/profile/${selectedFriend.username}`);
    }
  };

  const filteredFriends = friends
    .filter(friend => !blockedUsers.includes(friend.id))
    .filter(friend =>
      friend.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 md:p-6 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-7xl h-[calc(100vh-12rem)] animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Chat Container with Dashboard-style Card Layout */}
        <div className="group relative h-full">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
          <Card className="relative h-full border-0 bg-card/95 backdrop-blur-sm overflow-hidden shadow-2xl">
            <div className="h-full flex">
              {/* Sidebar */}
              <div className="w-80 border-r border-border/50 flex flex-col shrink-0 overflow-hidden h-full bg-gradient-to-b from-card/50 to-transparent">
                {/* Sidebar Header */}
                <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-black tracking-tight">{t.Dashboard.Friends}</h2>
                      <p className="text-xs text-muted-foreground font-medium">{friends.length} {friends.length === 1 ? 'contact' : 'contacts'}</p>
                    </div>
                  </div>
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search friends..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-background/60 border-border/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                </CardHeader>

                {/* Friends List - Scrollable */}
                <ScrollArea className="flex-1 min-h-0">
                  {friendsLoading ? (
                    <div className="p-4 text-center text-muted-foreground">{t.chat.loading}</div>
                  ) : friendsError ? (
                    <div className="p-4 text-center text-destructive">{friendsError}</div>
                  ) : (
                    <div className="p-3">
                      {filteredFriends.length === 0 ? (
                        <div className="p-8 text-center">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center mx-auto mb-3 ring-1 ring-border/50">
                            <Users className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground text-sm font-medium">
                            {searchQuery ? 'No friends found' : t.chat["No friends"]}
                          </p>
                        </div>
                      ) : (
                        filteredFriends.map(friend => (
                          <div
                            key={friend.id}
                            onClick={() => handleFriendClick(friend)}
                            className={`relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-2 group overflow-hidden ${
                              selectedFriend?.id === friend.id
                                ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg scale-[1.02]"
                                : "hover:bg-muted/50 hover:scale-[1.01] border border-transparent hover:border-primary/20"
                            }`}
                          >
                            {selectedFriend?.id !== friend.id && (
                              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            )}
                            <div className="relative z-10">
                              <Avatar className={`w-12 h-12 shrink-0 ring-2 ring-offset-2 transition-all ${
                                selectedFriend?.id === friend.id 
                                  ? 'ring-primary-foreground/30 ring-offset-primary' 
                                  : 'ring-transparent group-hover:ring-primary/20 ring-offset-card'
                              }`}>
                                {friend.avatar ? (
                                  <AvatarImage src={friend.avatar} alt={friend.username} />
                                ) : null}
                                <AvatarFallback className={`font-bold text-sm transition-all ${
                                  selectedFriend?.id === friend.id
                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                    : "bg-gradient-to-br from-primary/30 to-primary/10 text-primary group-hover:from-primary/40 group-hover:to-primary/20"
                                }`}>
                                  {friend.username[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {onlineFriends.some(f => Number(f.id) === Number(friend.id)) && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card shadow-lg">
                                  <div className="w-full h-full bg-green-400 rounded-full animate-ping opacity-75"></div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 relative z-10">
                              <p className={`font-semibold truncate transition-colors ${
                                selectedFriend?.id === friend.id ? "text-primary-foreground" : ""
                              }`}>
                                {friend.username}
                              </p>
                              <p className={`text-xs truncate transition-colors ${
                                selectedFriend?.id === friend.id ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}>
                                {onlineFriends.some(f => Number(f.id) === Number(friend.id)) 
                                  ? "● Active now" 
                                  : "Offline"
                                }
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Pending Requests Section */}
                {pending.length > 0 && (
                  <div className="border-t border-border/50 bg-gradient-to-r from-orange-500/5 to-transparent">
                    <div className="p-3 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/5 ring-1 ring-orange-500/20">
                          <UserPlus className="w-4 h-4 text-orange-500" />
                        </div>
                        <h3 className="text-sm font-bold flex-1">{t.chat["Pending Requests"]}</h3>
                        <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30">{pending.length}</Badge>
                      </div>
                    </div>
                    <ScrollArea className="max-h-40">
                      <div className="p-2">
                      {pending.map(req => (
                        <div
                          key={req.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-orange-500/10 transition-all border border-transparent hover:border-orange-500/20"
                        >
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-orange-500/30 to-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-xs">
                              {req.requester.username[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{req.requester.username}</p>
                            <p className="text-xs text-muted-foreground">Pending request</p>
                          </div>
                        </div>
                      ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ height: '100%' }}>
                {selectedFriend ? (
                  <>
                    {/* Chat Header */}
                    <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5">
                      <div className="flex items-center gap-4 flex-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="md:hidden -ml-2"
                          onClick={() => setSelectedFriend(null)}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="relative cursor-pointer" onClick={handleViewProfile}>
                          <div className="absolute -inset-1 bg-gradient-to-br from-primary via-purple-500 to-pink-500 rounded-full blur opacity-30"></div>
                          <Avatar className="relative w-12 h-12 ring-2 ring-primary/30 ring-offset-2 ring-offset-card">
                            {selectedFriend.avatar ? (
                              <AvatarImage src={selectedFriend.avatar} alt={selectedFriend.username} />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-black text-sm">
                              {selectedFriend.username[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {onlineFriends.some(f => Number(f.id) === Number(selectedFriend.id)) && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card shadow-lg">
                              <div className="w-full h-full bg-green-400 rounded-full animate-ping opacity-75"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h1 className="font-black text-xl truncate tracking-tight">{selectedFriend.username}</h1>
                          {isReady ? (
                            <div className="flex items-center gap-1.5">
                              {friendIsTyping ? (
                                <div className="flex items-center gap-1">
                                  <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                  </div>
                                  <p className="text-xs text-primary font-semibold ml-1">typing...</p>
                                </div>
                              ) : onlineFriends.some(f => Number(f.id) === Number(selectedFriend.id)) ? (
                                <>
                                  <div className="w-2 h-2 rounded-full bg-green-500">
                                    <div className="w-full h-full bg-green-400 rounded-full animate-ping"></div>
                                  </div>
                                  <p className="text-xs text-muted-foreground font-semibold">Active now</p>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground font-medium">Offline</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">{t.chat["Connecting to chat..."]}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGameInvite}
                            disabled={!isReady}
                            className="gap-2"
                          >
                            <Gamepad2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Invite to Game</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" suppressHydrationWarning>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={handleViewProfile}>
                                <UserCircle className="w-4 h-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setShowBlockDialog(true)}
                                className="text-destructive"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Block User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Messages Display  */}
                    <ScrollArea className="flex-1 min-h-0 bg-gradient-to-b from-muted/20 to-muted/30">
                      <div
                        ref={messagesContainerRef}
                        className="p-6"
                        style={{ scrollBehavior: 'smooth' }}
                      >
                      {loadingHistory ? (
                        <div className="flex items-center justify-center h-full min-h-[400px]">
                          <div className="text-center">
                            <div className="relative w-16 h-16 mx-auto mb-4">
                              <div className="absolute inset-0 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                              <div className="absolute inset-2 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
                            </div>
                            <p className="text-muted-foreground text-sm font-medium">{t.chat.loading}...</p>
                          </div>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                          <div className="relative mb-8">
                            <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 rounded-full blur-xl"></div>
                            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-primary/20 shadow-xl">
                              <MessageSquare className="w-12 h-12 text-primary" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-2xl ring-2 ring-card">
                              <Smile className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          <h3 className="text-2xl font-black tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">No messages yet</h3>
                          <p className="text-muted-foreground text-center text-sm max-w-sm font-medium">
                            Start the conversation by sending a message below!
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
                          <div className="flex items-center justify-center my-6">
                            <div className="flex items-center gap-3">
                              <div className="h-px flex-1 bg-border max-w-[100px]"></div>
                              <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-1.5 rounded-full border border-border">
                                {time.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                              </span>
                              <div className="h-px flex-1 bg-border max-w-[100px]"></div>
                            </div>
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
                            {msg.type === "notification" ? (
                              <div className="rounded-xl px-4 py-2 border border-primary/20 bg-primary/5 text-primary shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide mb-1">Notification</p>
                                <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                              </div>
                            ) : (
                              <div
                                className={`rounded-2xl px-4 py-3 shadow-lg transition-all hover:shadow-xl group-hover:scale-[1.01] ${
                                  isOwnMessage
                                    ? "bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-primary-foreground rounded-br-md"
                                    : "bg-card/90 backdrop-blur-sm border border-border/50 rounded-bl-md hover:border-primary/40"
                                }`}
                              >
                                <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                {msg.type === "game-invite" && !isOwnMessage && (
                                  <div className="flex gap-2 mt-3">
                                    <Button size="sm" variant="default" onClick={() => handleRespondInviteFromChat(msg, "accepted")}>
                                      Accept
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleRespondInviteFromChat(msg, "rejected")}>
                                      Decline
                                    </Button>
                                  </div>
                                )}
                                {msg.type === "game-invite-sent" && isOwnMessage && msg.meta?.roomId && (
                                  <div className="flex items-center gap-3 mt-3 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRoomFromChat(msg)}
                                      className="underline underline-offset-4 opacity-90 hover:opacity-100"
                                    >
                                      Open room {msg.meta.roomId.slice(0, 8)}...
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleHostStartGameFromChat(msg)}
                                      className="underline underline-offset-4 opacity-90 hover:opacity-100"
                                    >
                                      Start game now
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className={`flex items-center gap-1 mt-1 px-1 ${
                              isOwnMessage ? 'justify-end' : 'justify-start'
                            }`}>
                              <span className="text-xs text-muted-foreground">
                                {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isOwnMessage && (
                                <span className="text-xs text-muted-foreground">
                                  {msg.read ? (
                                    <CheckCheck className="w-3 h-3 text-primary" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
                      </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <CardContent className="border-t border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5 p-4">
                      <div className="flex gap-3 max-w-4xl mx-auto">
                        <div className="flex-1 relative group">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition duration-300"></div>
                          <Input
                            type="text"
                            placeholder={t.chat["Type a message..."]}
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                            disabled={!isReady}
                            className="relative h-12 bg-background/80 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all rounded-xl"
                          />
                        </div>
                        <div className="relative group">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-xl blur opacity-50 group-hover:opacity-100 transition duration-300"></div>
                          <Button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || !isReady}
                            size="lg"
                            className="relative px-6 h-12 shadow-lg hover:shadow-xl transition-all font-bold"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {t.chat.Send}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center overflow-hidden bg-gradient-to-br from-background/50 to-muted/30">
                    <div className="text-center p-8">
                      <div className="relative inline-block mb-8">
                        <div className="absolute -inset-4 bg-gradient-to-br from-primary/30 via-purple-500/30 to-pink-500/30 rounded-full blur-2xl"></div>
                        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center mx-auto ring-1 ring-primary/20 shadow-2xl">
                          <MessageSquare className="w-14 h-14 text-primary" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-2xl animate-bounce ring-2 ring-card">
                          <Users className="w-7 h-7 text-white" />
                        </div>
                      </div>
                      <h2 className="text-3xl font-black tracking-tight mb-3 bg-gradient-to-r from-foreground via-primary/70 to-foreground bg-clip-text text-transparent">Select a friend to start chatting</h2>
                      <p className="text-muted-foreground max-w-md mx-auto text-sm font-medium">
                        Choose someone from your friends list to begin a conversation and stay connected!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Block User Confirmation Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block User</DialogTitle>
            <DialogDescription>
              Are you sure you want to block {selectedFriend?.username}? You won't be able to send or receive messages from this user.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBlockUser}>
              Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
