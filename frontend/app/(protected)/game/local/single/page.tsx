"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, UserPlus, X, Play, ArrowLeft, Gamepad2 } from "lucide-react";
import { useLanguage } from "@/context/languageContext";

type AIDifficulty = "easy" | "medium" | "hard";

export default function LocalSingleMatchPage() {
	const router = useRouter();
	const { user } = useAuth();
	const { t } = useLanguage();
	const [tempPlayerName, setTempPlayerName] = useState("");
	const [player2, setPlayer2] = useState<{ name: string; isTemp: boolean } | null>(null);
	const [isAIOpponent, setIsAIOpponent] = useState(false);
	const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>("medium");

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
		if (!isAIOpponent && !player2) return;

		// Create match data
		const matchData = {
			matchId: `local-${Date.now()}`,
			mode: "local",
			isAI: isAIOpponent,
			aiDifficulty,
			player1: {
				id: user?.id,
				name: user?.username || "You",
				isTemp: false
			},
			player2: isAIOpponent
				? { name: `AI (${aiDifficulty})`, isTemp: true, isAI: true }
				: player2
		};

		// Store match data
		localStorage.setItem("current-match", JSON.stringify(matchData));

		// Navigate to game
		router.push(`/game/${matchData.matchId}`);
	};

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						onClick={() => router.push("/game/new/local")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Local Selection
					</Button>
				</div>

				<div className="relative group">
					<div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl overflow-hidden">
						{/* Background Decoration */}
						<div className="absolute top-0 right-0 p-8 opacity-5">
							<Gamepad2 className="h-64 w-64 -mr-16 -mt-16" />
						</div>

						<CardHeader className="text-center pb-2 relative z-10">
							<div className="mx-auto p-4 rounded-full bg-purple-500/10 mb-4 ring-1 ring-purple-500/20">
								<Gamepad2 className="h-10 w-10 text-purple-500" />
							</div>
							<CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
							{t.Game["Single Match"]}
						</CardTitle>
						<CardDescription className="text-base">
							{t.Game["Classic 1v1 Duel on this device"]}
							</CardDescription>
						</CardHeader>

						<CardContent className="space-y-8 relative z-10 pt-6">
							<div className="space-y-4 rounded-xl border bg-background/40 p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-semibold">{t.Game["AI Opponent Mode"]}</p>
										<p className="text-xs text-muted-foreground">
											{t.Game["Toggle to play against a bot in Local 1v1."]}
										</p>
									</div>
									<Button
										type="button"
										variant={isAIOpponent ? "default" : "outline"}
										onClick={() => setIsAIOpponent((prev) => !prev)}
									>
										{isAIOpponent ? t.Game["Enabled"] : t.Game["Disabled"]}
									</Button>
								</div>

								{isAIOpponent && (
									<div className="space-y-2">
										<Label className="text-xs uppercase tracking-wider text-muted-foreground">
											{t.Game["AI Difficulty"]}
										</Label>
										<div className="grid grid-cols-3 gap-2">
											{(["easy", "medium", "hard"] as const).map((difficulty) => (
												<Button
													key={difficulty}
													type="button"
													variant={aiDifficulty === difficulty ? "default" : "outline"}
													onClick={() => setAIDifficulty(difficulty)}
													className="capitalize"
												>
													{t.Game[difficulty.charAt(0).toUpperCase() + difficulty.slice(1) as "Easy" | "Medium" | "Hard"]}
												</Button>
											))}
										</div>
									</div>
								)}
							</div>

							{/* Players Arena */}
							<div className="grid gap-6">
								{/* Player 1 */}
								<div className="relative group/p1">
									<div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-hover/p1:opacity-100 transition duration-500"></div>
									<div className="relative flex items-center gap-4 p-4 bg-background/50 border rounded-xl hover:bg-background/80 transition-colors">
										<div className="relative">
											<div className="absolute -inset-1 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full blur opacity-40"></div>
											<div className="relative p-3 bg-card rounded-full border">
												<User className="h-6 w-6 text-blue-500" />
											</div>
										</div>
										<div className="flex-1">
											<Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t.Game["Player 1 (You)"]}</Label>
											<p className="font-bold text-lg leading-tight">{user?.username || "Account User"}</p>
										</div>
									</div>
								</div>

								<div className="relative flex items-center justify-center">
									<div className="absolute inset-0 flex items-center">
										<div className="w-full border-t border-dashed border-border"></div>
									</div>
									<div className="relative px-4 bg-card text-xs font-semibold text-muted-foreground uppercase tracking-widest">
										VS
									</div>
								</div>

								{/* Player 2 */}
								<div className="relative group/p2">
									{isAIOpponent ? (
										<div className="relative group/card-p2">
											<div className="absolute -inset-0.5 bg-gradient-to-r from-fuchsia-500/20 to-violet-500/20 rounded-xl blur opacity-0 group-hover/card-p2:opacity-100 transition duration-500"></div>
											<div className="relative flex items-center gap-4 p-4 bg-background/50 border rounded-xl hover:bg-background/80 transition-colors">
												<div className="relative">
													<div className="absolute -inset-1 bg-gradient-to-br from-fuchsia-500 to-violet-500 rounded-full blur opacity-40"></div>
													<div className="relative p-3 bg-card rounded-full border">
														<Gamepad2 className="h-6 w-6 text-fuchsia-500" />
													</div>
												</div>
												<div className="flex-1">
													<Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t.Game["Player 2 (AI)"]}</Label>
													<p className="font-bold text-lg leading-tight capitalize">{aiDifficulty} Bot</p>
												</div>
											</div>
										</div>
									) : !player2 ? (
										<div className="space-y-4 p-6 border-2 border-dashed rounded-xl bg-muted/10 hover:bg-muted/20 transition-colors text-center">
											<div className="space-y-2">
											<h3 className="font-medium">{t.Game["Challenger Awaits"]}</h3>
											<p className="text-sm text-muted-foreground">{t.Game["Enter guest name to join"]}</p>
										</div>
										<div className="flex gap-3 max-w-sm mx-auto">
											<Input
												placeholder={t.Game["Player Name ..."]}
													value={tempPlayerName}
													onChange={(e) => setTempPlayerName(e.target.value)}
													onKeyPress={(e) => e.key === "Enter" && handleAddTempPlayer()}
													className="bg-background/50 h-11"
												/>
												<Button
													onClick={handleAddTempPlayer}
													disabled={!tempPlayerName.trim()}
													className="h-11 px-6 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-lg shadow-pink-500/20"
												>
													<UserPlus className="h-4 w-4" />
												</Button>
											</div>
										</div>
									) : (
										<div className="relative group/card-p2">
											<div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500/20 to-rose-500/20 rounded-xl blur opacity-0 group-hover/card-p2:opacity-100 transition duration-500"></div>
											<div className="relative flex items-center gap-4 p-4 bg-background/50 border rounded-xl hover:bg-background/80 transition-colors">
												<div className="relative">
													<div className="absolute -inset-1 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full blur opacity-40"></div>
													<div className="relative p-3 bg-card rounded-full border">
														<User className="h-6 w-6 text-pink-500" />
													</div>
												</div>
												<div className="flex-1">
													<Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t.Game["Player 2 (Guest)"]}</Label>
													<p className="font-bold text-lg leading-tight">{player2.name}</p>
												</div>
												<Button
													variant="ghost"
													size="icon"
													onClick={handleRemovePlayer2}
													className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
												>
													<X className="h-5 w-5" />
												</Button>
											</div>
										</div>
									)}
								</div>
							</div>

							<div className="space-y-6 pt-6">
								<Button
									onClick={handleStartMatch}
									disabled={!isAIOpponent && !player2}
									size="lg"
									className="w-full text-lg h-16 font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02]"
								>
									<Play className="mr-2 h-6 w-6 fill-current" />
									{t.Game["Start Match"]}
								</Button>

								<div className="flex justify-center gap-8 text-sm text-muted-foreground/80 bg-background/50 p-4 rounded-xl border">
									<div className="flex gap-2 items-center">
										<span className="w-6 h-6 rounded flex items-center justify-center bg-muted font-mono text-xs border">W</span>
										<span className="w-6 h-6 rounded flex items-center justify-center bg-muted font-mono text-xs border">S</span>
										<span className="font-medium">{t.Game["Player 1"]}</span>
									</div>
									<div className="w-px bg-border"></div>
									<div className="flex gap-2 items-center">
										{isAIOpponent ? (
											<span className="font-medium capitalize">AI ({aiDifficulty}) controls {t.Game["Player 2"]}</span>
										) : (
											<>
												<span className="w-6 h-6 rounded flex items-center justify-center bg-muted font-mono text-xs border">↑</span>
												<span className="w-6 h-6 rounded flex items-center justify-center bg-muted font-mono text-xs border">↓</span>
												<span className="font-medium">{t.Game["Player 2"]}</span>
											</>
										)}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
