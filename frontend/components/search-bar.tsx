"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Loader2, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/languageContext";
import {
	FRIEND_SEARCH_MAX_LENGTH,
	validateFriendSearchQuery,
} from "@/lib/friends-validation";

export interface FriendSearchSuggestion {
	id: number;
	username: string;
	fullname: string;
	avatar?: string | null;
}

interface SearchBarProps {
	onSelectUser: (user: FriendSearchSuggestion) => void;
}

/** Search for several eligible profiles and require an explicit selection. */
export default function SearchBar({ onSelectUser }: SearchBarProps) {
	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState<FriendSearchSuggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const requestIdRef = useRef(0);
	const { t } = useLanguage();

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	const search = (value: string) => {
		setQuery(value);
		setShowSuggestions(true);
		if (timerRef.current) clearTimeout(timerRef.current);

		const validation = validateFriendSearchQuery(value);
		if (!validation.ok) {
			requestIdRef.current += 1;
			setSuggestions([]);
			setLoading(false);
			return;
		}

		const requestId = ++requestIdRef.current;
		setLoading(true);
		timerRef.current = setTimeout(async () => {
			try {
				const response = await axios.get<FriendSearchSuggestion[]>(
					`/api/friends/search?user=${encodeURIComponent(validation.value)}`,
				);
				if (requestId === requestIdRef.current) setSuggestions(response.data);
			} catch {
				if (requestId === requestIdRef.current) setSuggestions([]);
			} finally {
				if (requestId === requestIdRef.current) setLoading(false);
			}
		}, 250);
	};

	const select = (suggestion: FriendSearchSuggestion) => {
		onSelectUser(suggestion);
		setQuery(suggestion.username);
		setSuggestions([]);
		setShowSuggestions(false);
	};

	const hasValidQuery = validateFriendSearchQuery(query).ok;

	return (
		<div className="relative">
			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					className="px-9 py-2"
					placeholder={t.Dashboard.Search}
					value={query}
					onChange={(event) => search(event.target.value)}
					onFocus={() => setShowSuggestions(true)}
					maxLength={FRIEND_SEARCH_MAX_LENGTH}
					autoComplete="off"
					aria-label="Search players by nickname or name"
				/>
				{loading && (
					<Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
				)}
			</div>

			{showSuggestions && hasValidQuery && !loading && (
				<div className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
					{suggestions.length > 0 ? (
						suggestions.map((suggestion) => (
							<button
								key={suggestion.id}
								type="button"
								onClick={() => select(suggestion)}
								className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
							>
								<Avatar className="h-9 w-9">
									<AvatarImage src={suggestion.avatar || undefined} />
									<AvatarFallback>{suggestion.username[0]?.toUpperCase()}</AvatarFallback>
								</Avatar>
								<span className="min-w-0">
									<span className="block truncate font-medium">@{suggestion.username}</span>
									<span className="block truncate text-xs text-muted-foreground">{suggestion.fullname}</span>
								</span>
							</button>
						))
					) : (
						<p className="px-3 py-4 text-center text-sm text-muted-foreground">No eligible players found.</p>
					)}
				</div>
			)}
		</div>
	);
}
