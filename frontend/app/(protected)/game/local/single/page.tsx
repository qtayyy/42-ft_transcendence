"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, UserPlus, X, Play, ArrowLeft } from "lucide-react";

export default function LocalSingleMatchPage() {
	const router = useRouter();
	const { user } = useAuth();
	const [tempPlayerName, setTempPlayerName] = useState("");
	const [player2, setPlayer2] = useState<{name: string; isTemp: boolean} | null>(null);

	const handleAddTempPlayer = () => {
		if (tempPlayerName.trim()) {
			setPlayer2({
				name: tempPlayerName.trim(),
				isTemp: true
			});
			setTempPlayerName("");
		}
	};

	const handleRemovePlayer2 = () => {
		setPlayer2(null);
	};

	const handleStartMatch = () => {
		if (!player2) return;

		// Create match data
		const matchData = {
			matchId: `local-${Date.now()}`,
			mode: "local",
			player1: {
				id: user?.id,
				name: user?.username || "You", 
				isTemp: false
			},
			player2: player2
		};

		// Store match data
		localStorage.setItem("current-match", JSON.stringify(matchData));

		// Navigate to game
		router.push(`/game/${matchData.matchId}`);
	};

	return (
		<div className="container mx-auto max-w-2xl px-6 flex flex-col justify-center min-h-[calc(100vh-12rem)]">
			<div className="mb-6">
				<Button 
					variant="ghost" 
					onClick={() => router.push("/game/new")}
					className="gap-2"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Modes
				</Button>
			</div>

			<Card className="border-2 shadow-lg">
				<CardHeader className="text-center space-y-2">
					<CardTitle className="text-3xl">Local Single Match</CardTitle>
					<CardDescription>
						Set up a 1v1 match on this device
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-8">
					{/* Account User (Player 1) */}
					<div className="space-y-3">
						<Label className="text-lg font-semibold">Player 1 (You)</Label>
						<div className="flex items-center gap-4 p-4 bg-primary/5 border rounded-lg">
							<div className="p-2 bg-primary/10 rounded-full">
								<User className="h-6 w-6 text-primary" />
							</div>
							<div className="flex-1">
								<p className="font-semibold text-lg">{user?.username || "Account User"}</p>
								<p className="text-sm text-muted-foreground">Account Player</p>
							</div>
						</div>
					</div>

					{/* Player 2 */}
					<div className="space-y-3">
						<Label className="text-lg font-semibold">Player 2</Label>
						{!player2 ? (
							<div className="space-y-4">
								<div className="flex gap-3">
									<Input
										placeholder="Enter player name..."
										value={tempPlayerName}
										onChange={(e) => setTempPlayerName(e.target.value)}
										onKeyPress={(e) => e.key === "Enter" && handleAddTempPlayer()}
										className="h-11"
									/>
									<Button
										onClick={handleAddTempPlayer}
										disabled={!tempPlayerName.trim()}
										className="h-11"
									>
										<UserPlus className="h-4 w-4 mr-2" />
										Add
									</Button>
								</div>
								<p className="text-sm text-muted-foreground">
									This creates a temporary guest player for this session.
								</p>
							</div>
						) : (
							<div className="flex items-center gap-4 p-4 bg-secondary/50 border rounded-lg">
								<div className="p-2 bg-secondary rounded-full">
									<User className="h-6 w-6 text-secondary-foreground" />
								</div>
								<div className="flex-1">
									<p className="font-semibold text-lg">{player2.name}</p>
									<p className="text-sm text-muted-foreground">Temporary Player</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onClick={handleRemovePlayer2}
									className="text-destructive hover:text-destructive hover:bg-destructive/10"
								>
									<X className="h-5 w-5" />
								</Button>
							</div>
						)}
					</div>

					<div className="space-y-4 pt-4">
						<Button
							onClick={handleStartMatch}
							disabled={!player2}
							size="lg"
							className="w-full text-lg h-14"
						>
							<Play className="mr-2 h-5 w-5" />
							Start Match
						</Button>

						<div className="bg-muted/50 p-4 rounded-lg text-center space-y-2">
							<p className="text-sm font-medium">Game Controls</p>
							<div className="flex justify-center gap-8 text-sm text-muted-foreground">
								<span><strong className="text-foreground">Player 1:</strong> W / S</span>
								<span><strong className="text-foreground">Player 2:</strong> Up / Down</span>
							</div>
							<p className="text-xs text-muted-foreground pt-2">
								First to 5 points wins
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
