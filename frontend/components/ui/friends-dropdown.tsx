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
import { useLanguage } from '@/context/languageContext';

export default function FriendsDropdown({ friends, onInvite, gameRoom }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { t } = useLanguage();

  const filtered = friends.filter((f) => {
    const isAlreadyJoined = gameRoom?.joinedPlayers.some((j) => j.id === f.id);
    const isAlreadyInvited = gameRoom?.invitedPlayers.some(
      (i) => i.id === f.id
    );
    return (
      f.username.toLowerCase().includes(search.toLowerCase()) &&
      !isAlreadyJoined &&
      !isAlreadyInvited
    );
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {t.Dashboard.Friends}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={t.Dashboard.Search}
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>{t.Dashboard.Friends} {t.Dashboard.Offline}</CommandEmpty>

          <CommandList>
            <ScrollArea className="h-52">
              <CommandGroup>
                {filtered.map((friend, index) => (
                  <CommandItem
                    key={`${friend.id}-${index}`}
                    className="flex items-center justify-between pr-2"
                  >
                    <span>{friend.username}</span>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInvite({ id: friend.id, username: friend.username });
                      }}
                    >
                      {t.Dashboard.Friends}
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
