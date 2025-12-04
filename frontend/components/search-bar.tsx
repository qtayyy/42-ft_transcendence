"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SearchBar({ searchUser }) {
  const [query, setQuery] = useState("");

  const handleInputChange = (event) => {
    setQuery(event.target.value);
  };

  const handleSearchClick = () => {
    searchUser(query);
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Bind the input field to the query state */}
      <Input
        type="text"
        className="px-3 py-2"
        placeholder="Type your friend's username or email here..."
        value={query}
        onChange={handleInputChange}
      />
      <Button className="px-3 py-2" onClick={handleSearchClick}>
        Search
      </Button>
    </div>
  );
}
