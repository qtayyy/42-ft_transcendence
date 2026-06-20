import { useEffect, useState, useCallback } from 'react';

export interface Friend {
  id: string;
  username: string;
  avatar?: string | null;
}

export interface PendingFriend {
  id: string;
  requester: { id: string; username: string };
}

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        fetch('/api/friends'),
        fetch('/api/friends/pending'),
      ]);
      if (!friendsRes.ok) throw new Error('Failed to fetch friends');
      if (!pendingRes.ok) throw new Error('Failed to fetch pending requests');
      const friendsData = await friendsRes.json();
      const pendingData = await pendingRes.json();
      setFriends(friendsData || []);
      setPending(pendingData || []);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Keep every mounted friend list synchronized when either side unfriends.
  useEffect(() => {
    const handleFriendRemoved = () => fetchAll();
    window.addEventListener("friendRemoved", handleFriendRemoved);
    return () => window.removeEventListener("friendRemoved", handleFriendRemoved);
  }, [fetchAll]);

  // Expose refetch function for real-time updates
  const refetch = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  // Refresh friends list when a sent request is accepted by the other user
  useEffect(() => {
    const handleFriendAccepted = () => fetchAll();
    window.addEventListener("friendAccepted", handleFriendAccepted);
    return () => window.removeEventListener("friendAccepted", handleFriendAccepted);
  }, [fetchAll]);

  return { friends, pending, loading, error, refetch };
}
