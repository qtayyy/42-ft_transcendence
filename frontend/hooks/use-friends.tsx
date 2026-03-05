import { useEffect, useState } from 'react';

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

  useEffect(() => {
    async function fetchAll() {
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
    }
    fetchAll();
  }, []);

  return { friends, pending, loading, error };
}
