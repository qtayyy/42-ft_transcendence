import { useEffect, useState } from 'react';

export interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
}

export function useChat() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFriends() {
      setLoading(true);
      setError(null);
      try {
        
        const res = await fetch('/api/friends');
        if (!res.ok) throw new Error('Failed to fetch friends');
        const data = await res.json();
        setFriends(data || []);
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
    fetchFriends();
  }, []);

  return { friends, loading, error };
}
