"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/languageContext";
import { toast } from "sonner";
import {
	FRIEND_SEARCH_MAX_LENGTH,
	validateFriendSearchQuery,
} from "@/lib/friends-validation";

type SearchBarProps = {
	searchUser: (query: string) => void;
};

export default function SearchBar({ searchUser }: SearchBarProps) {
	const [query, setQuery] = useState("");
	const { t } = useLanguage();
	const canSearch = validateFriendSearchQuery(query).ok;

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(event.target.value);
	};

	const handleSearchClick = () => {
		const result = validateFriendSearchQuery(query);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		searchUser(result.value);
	};

	return (
		<div className="flex items-center space-x-2">
			<Input
				type="text"
				className="px-3 py-2"
				placeholder={t.Dashboard.Search}
				value={query}
				onChange={handleInputChange}
				maxLength={FRIEND_SEARCH_MAX_LENGTH}
			/>
			<Button
				className="px-3 py-2"
				onClick={handleSearchClick}
				disabled={!canSearch}
			>
				{t.Dashboard.Search}
			</Button>
		</div>
	);
}
