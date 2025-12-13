"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LocalSingleInvitePage() {
	const router = useRouter();

	useEffect(() => {
		// For local single match with "invite" (setup), just create and start
		const matchId = `local-${Date.now()}`;
		const timer = setTimeout(() => {
			router.push(`/game/${matchId}`);
		}, 1000);
		return () => clearTimeout(timer);
	}, [router]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
			<Card className="w-full max-w-md border-2 border-pink-500/50 bg-gray-800/50">
				<CardHeader>
					<CardTitle className="text-center text-2xl text-white">
						Setting Up Local Match
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center space-y-4">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-500 border-t-transparent"></div>
					<p className="text-gray-300">Preparing game for 2 players...</p>
					<p className="text-sm text-gray-400">
						Player 1: W/S | Player 2: Arrow Keys
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
