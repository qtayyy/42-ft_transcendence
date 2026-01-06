"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Trophy, Loader2, Users, X } from "lucide-react";

export default function TournamentMatchmakingPage() {
	const router = useRouter();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const [searching, setSearching] = useState(true);
	const [searchTime, setSearchTime] = useState(0);
	const [playersInQueue, setPlayersInQueue] = useState(1);

	// Search timer
	useEffect(() => {
		if (!searching) return;
		const timer = setInterval(() => {
			setSearchTime(prev => prev + 1);
		}, 1000);
		return () => clearInterval(timer);
	}, [searching]);

	// Simulated queue updates
	useEffect(() => {
		if (!searching) return;
		const interval = setInterval(() => {
			setPlayersInQueue(prev => Math.min(prev + Math.floor(Math.random() * 2), 8));
		}, 2500);
		return () => clearInterval(interval);
	}, [searching]);

	// Join matchmaking queue
	useEffect(() => {
		if (!user || !isReady) return;
		sendSocketMessage({
			event: "JOIN_MATCHMAKING",
			payload: {
				userId: user.id,
				username: user.username,
				mode: "tournament",
			},
		});
	}, [user, isReady, sendSocketMessage]);

	const handleCancel = () => {
		setSearching(false);
		if (user && isReady) {
			sendSocketMessage({
				event: "LEAVE_MATCHMAKING",
				payload: { userId: user.id },
			});
		}
		router.push("/game/remote/tournament");
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
				
				<div className="flex items-center justify-between">
					<Button 
						variant="ghost" 
						onClick={handleCancel}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Cancel
					</Button>
				</div>

				<div className="relative group">
					<div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-pink-500 rounded-2xl blur opacity-30 animate-pulse"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
						<CardHeader className="text-center pb-4">
							<div className="mx-auto p-4 rounded-full bg-rose-500/10 mb-4 ring-1 ring-rose-500/20 relative">
								<Trophy className="h-8 w-8 text-rose-500" />
								<div className="absolute inset-0 rounded-full border-2 border-rose-500/30 animate-ping"></div>
							</div>
							<CardTitle className="text-2xl font-bold">Finding Tournament</CardTitle>
							<CardDescription>Looking for competitors...</CardDescription>
						</CardHeader>

						<CardContent className="space-y-6">
							{/* Search Animation */}
							<div className="flex justify-center py-8">
								<div className="relative">
									<div className="w-24 h-24 rounded-full border-4 border-muted"></div>
									<div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-transparent border-t-rose-500 animate-spin"></div>
									<div className="absolute inset-2 w-20 h-20 rounded-full border-4 border-transparent border-t-pink-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
									<div className="absolute inset-0 flex items-center justify-center">
										<Trophy className="h-8 w-8 text-rose-500 animate-pulse" />
									</div>
								</div>
							</div>

							{/* Stats */}
							<div className="grid grid-cols-2 gap-4">
								<div className="text-center p-4 bg-muted/30 rounded-xl">
									<p className="text-2xl font-bold font-mono">{formatTime(searchTime)}</p>
									<p className="text-xs text-muted-foreground uppercase tracking-wider">Search Time</p>
								</div>
								<div className="text-center p-4 bg-muted/30 rounded-xl">
									<div className="flex items-center justify-center gap-1">
										<Users className="h-5 w-5 text-muted-foreground" />
										<span className="text-2xl font-bold">{playersInQueue}/8</span>
									</div>
									<p className="text-xs text-muted-foreground uppercase tracking-wider">Forming</p>
								</div>
							</div>

							{/* Progress */}
							<div className="space-y-2">
								<div className="flex justify-between text-xs text-muted-foreground">
									<span>Tournament Forming</span>
									<span>{Math.round((playersInQueue / 8) * 100)}%</span>
								</div>
								<div className="h-2 bg-muted rounded-full overflow-hidden">
									<div 
										className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
										style={{ width: `${(playersInQueue / 8) * 100}%` }}
									></div>
								</div>
							</div>

							{/* Cancel Button */}
							<Button
								onClick={handleCancel}
								variant="outline"
								size="lg"
								className="w-full text-lg h-14 font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
							>
								<X className="mr-2 h-5 w-5" />
								Cancel Search
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
