"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { FriendRequest } from "@/type/types";

export default function FriendRequestsPage() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);

  const fetchRequests = async () => {
    const res = await axios.get("/api/friends/pending");
    setRequests(res.data);
  };

  useEffect(() => {
    async function load() {
      await fetchRequests();
    }
    load();
  }, []);

  const accept = async (id: number) => {
    await axios.put(`/api/friends/request/${id}/accept`);
    fetchRequests();
  };

  const decline = async (id: number) => {
    await axios.put(`/api/friends/request/${id}/decline`);
    fetchRequests();
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Friend Requests</h1>

      {requests.length === 0 && <p>No pending requests</p>}

      {requests.map((req) => (
        <div
          key={req.id}
          className="flex items-center justify-between border p-3 rounded-lg mb-2"
        >
          <span>{req.requester.username}</span>

          <div className="flex gap-2">
            <Button onClick={() => accept(req.id)}>Accept</Button>
            <Button variant="destructive" onClick={() => decline(req.id)}>
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
