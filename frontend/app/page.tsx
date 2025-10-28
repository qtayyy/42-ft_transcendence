"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [msg, setMsg] = useState("This is a test");

  useEffect(() => {
    console.log("Client component mounted");
  }, []);

  return (
    <div>
      <h1>Frontend (Next.js)</h1>
      <p>Backend says: {msg}</p>
    </div>
  );
}
