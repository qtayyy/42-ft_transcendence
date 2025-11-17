"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown } from "lucide-react";

export default function FriendsDropdown({ friends, onInvite }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = friends.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Invite Friends
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search friends..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>No friends found.</CommandEmpty>

          <CommandList>
            <ScrollArea className="h-52">
              <CommandGroup>
                {filtered.map((friend) => (
                  <CommandItem
                    key={friend.value}
                    className="flex items-center justify-between pr-2"
                  >
                    <span>{friend.label}</span>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInvite(friend.value);
                      }}
                    >
                      Invite
                    </Button>
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
