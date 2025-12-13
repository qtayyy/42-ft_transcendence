"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LocalSingleMatchmakingPage() {
	const router = useRouter();

	useEffect(() => {
		// For local matchmaking (quick start), just create and start
		const matchId = `local-quick-${Date.now()}`;
		const timer = setTimeout(() => {
			router.push(`/game/${matchId}`);
		}, 800);
		return () => clearTimeout(timer);
	}, [router]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
			<Card className="w-full max-w-md border-2 border-orange-500/50 bg-gray-800/50">
				<CardHeader>
					<CardTitle className="text-center text-2xl text-white">
						Quick Start
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center space-y-4">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
					<p className="text-gray-300">Starting match...</p>
				</CardContent>
			</Card>
		</div>
	);
}
