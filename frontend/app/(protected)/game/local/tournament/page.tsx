"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, UserPlus, X, ArrowLeft, Trophy, Crown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { handleSessionExpiredRedirect } from "@/lib/session-expired";
import { useLanguage } from "@/context/languageContext";
import {
	LOCAL_GUEST_NAME_MAX_LENGTH,
	LOCAL_TOURNAMENT_MAX_PLAYERS,
	LOCAL_TOURNAMENT_MIN_PLAYERS,
	validateLocalPlayerName,
} from "@/lib/local-play-validation";

export default function LocalTournamentPage() {
	const router = useRouter();
	const { user } = useAuth();
	const { t } = useLanguage();
	const [tempPlayerName, setTempPlayerName] = useState("");
	const [tempPlayers, setTempPlayers] = useState<Array<{name: string}>>([]);
	const [validationError, setValidationError] = useState("");

	const totalPlayers = 1 + tempPlayers.length; // Account user + temp players

	const handleAddTempPlayer = () => {
		if (totalPlayers >= LOCAL_TOURNAMENT_MAX_PLAYERS) {
			setValidationError(`Local tournaments support up to ${LOCAL_TOURNAMENT_MAX_PLAYERS} players.`);
			return;
		}

		const result = validateLocalPlayerName(
			tempPlayerName,
			[user?.username || "You", ...tempPlayers.map((player) => player.name)],
			"Guest name"
		);

		if (!result.ok) {
			setValidationError(result.error);
			return;
		}

		setTempPlayers([...tempPlayers, { name: result.value }]);
		setTempPlayerName("");
		setValidationError("");
	};

	const handleRemoveTempPlayer = (index: number) => {
		setTempPlayers(tempPlayers.filter((_, i) => i !== index));
		setValidationError("");
	};

	const canStartTournament =
		totalPlayers >= LOCAL_TOURNAMENT_MIN_PLAYERS &&
		totalPlayers <= LOCAL_TOURNAMENT_MAX_PLAYERS;

	const handleStartTournament = async () => {
		if (!canStartTournament) return;
		if (!user?.id) {
			setValidationError("You must be signed in to host a local tournament.");
			return;
		}

		try {
			// Local tournaments must use a local-prefixed ID.
			// If we let backend default to RT-*, local match IDs become RT-* and
			// runtime misclassifies them as remote matches.
			const localTournamentId = `local-tournament-${Date.now()}`;

			// Build full player list
			const allPlayers = [
				{ id: user.id, name: user.username || "You", isTemp: false },
				...tempPlayers.map((p, i) => ({ id: `temp-${Date.now()}-${i}`, name: p.name, isTemp: true }))
			];

			// Create tournament via backend
			const response = await axios.post("/api/tournament/create", {
				players: allPlayers,
				tournamentId: localTournamentId,
			});

			const { tournamentId } = response.data;

			// Navigate to tournament page
			router.push(`/game/local/tournament/${tournamentId}`);
		} catch (error) {
			if (handleSessionExpiredRedirect(error, router, "/game/local/tournament")) return;
			console.error("Failed to create tournament:", error);
			alert("Failed to create tournament. Please try again.");
		}
	};

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
				
				<div className="flex items-center justify-between">
					<Button 
						variant="ghost" 
						onClick={() => router.push("/game/new/local")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						{t.Game["Back to Local Selection"]}
					</Button>
				</div>

				<div className="relative group">
					<div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl overflow-hidden">
						{/* Background Decoration */}
						<div className="absolute top-0 right-0 p-8 opacity-5">
							<Trophy className="h-72 w-72 -mr-12 -mt-12" />
						</div>

						<CardHeader className="text-center pb-2 relative z-10">
							<div className="mx-auto p-4 rounded-full bg-yellow-500/10 mb-4 ring-1 ring-yellow-500/20 animate-pulse">
								<Trophy className="h-10 w-10 text-yellow-500" />
							</div>
							<CardTitle className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
								{t.Game["Local Tournament"]}
							</CardTitle>
							<CardDescription className="text-base">
								{t.Game["Setup a bracket elimination for 3-8 players"]}
							</CardDescription>
						</CardHeader>

						<CardContent className="space-y-8 relative z-10 pt-6">
							
							{/* Player Addition Zone */}
							<div className="space-y-4">
								<div className="flex gap-3">
									<Input
									placeholder={t.Game["Add Guest Player Name..."]}
									value={tempPlayerName}
									maxLength={LOCAL_GUEST_NAME_MAX_LENGTH}
									onChange={(e) => {
										setTempPlayerName(e.target.value);
										setValidationError("");
									}}
									onKeyDown={(e) => e.key === "Enter" && handleAddTempPlayer()}
									className="h-12 bg-background/50 text-lg border-muted-foreground/20"
									disabled={totalPlayers >= LOCAL_TOURNAMENT_MAX_PLAYERS}
								/>
								<Button
									onClick={handleAddTempPlayer}
									disabled={!tempPlayerName.trim() || totalPlayers >= LOCAL_TOURNAMENT_MAX_PLAYERS}
									className="h-12 px-8 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-semibold shadow-lg shadow-yellow-500/20"
								>
									<UserPlus className="h-5 w-5 mr-2" />
									{t.Game["Add Player"]}
									</Button>
								</div>
								{validationError && (
									<p className="text-xs font-medium text-destructive text-center">
										{validationError}
									</p>
								)}
								<p className="text-xs text-muted-foreground text-center uppercase tracking-widest font-semibold">
									{t.Game["MAX 8 PLAYERS"]} • {LOCAL_TOURNAMENT_MAX_PLAYERS - totalPlayers} {t.Game["SPOTS REMAINING"]}
								</p>
							</div>

							{/* Player Registry */}
							<div className="space-y-3">
								<Label className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">{t.Game["REGISTERED CONTENDERS"]} ({totalPlayers})</Label>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
									{/* Account User */}
									<div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl">
										<div className="p-2 bg-primary/20 rounded-full">
											<Crown className="h-5 w-5 text-primary" />
										</div>
										<div className="flex-1 min-w-0">
											<p className="font-bold truncate">{user?.username || "Account User"}</p>
											<p className="text-xs text-primary/70 font-semibold">{t.Game["Tournament Host"]}</p>
										</div>
									</div>

									{/* Guest Players */}
									{tempPlayers.map((player, index) => (
										<div key={index} className="group relative flex items-center gap-3 p-3 bg-secondary/30 border border-border/50 rounded-xl hover:bg-secondary/50 transition-colors">
											<div className="p-2 bg-secondary rounded-full">
												<User className="h-5 w-5 text-muted-foreground" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="font-semibold truncate">{player.name}</p>
												<p className="text-xs text-muted-foreground">Guest Challenger</p>
											</div>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleRemoveTempPlayer(index)}
												className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							</div>

							{/* Status and Action */}
							<div className="space-y-6 pt-4 border-t border-border/50">
								<Alert variant={canStartTournament ? "default" : "destructive"} className={`block transition-all duration-300 ${canStartTournament ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
									<div className="flex items-center gap-3">
										<div className={`p-2 rounded-full ${canStartTournament ? "bg-green-500/20 text-green-500" : "bg-destructive/10 text-destructive"}`}>
											{canStartTournament ? <Trophy className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
										</div>
										<div className="flex-1">
											<AlertTitle className={`text-sm font-bold ${canStartTournament ? "text-green-500" : "text-destructive"}`}>
												{canStartTournament ? "Tournament Ready!" : t.Game["More Players Needed"]}
											</AlertTitle>
											<AlertDescription className="text-xs text-muted-foreground">
												{totalPlayers < LOCAL_TOURNAMENT_MIN_PLAYERS ? (
													t.Game["Recruit 2 more contenders to begin (Min 3)."].replace("2", String(LOCAL_TOURNAMENT_MIN_PLAYERS - totalPlayers))
												) : totalPlayers > LOCAL_TOURNAMENT_MAX_PLAYERS ? (
													`Too many players! Remove ${totalPlayers - LOCAL_TOURNAMENT_MAX_PLAYERS} to proceed.`
												) : (
													`Format: ${totalPlayers <= 4 ? 'Round Robin Series' : 'Swiss Elimination System'}`
												)}
											</AlertDescription>
										</div>
									</div>
								</Alert>

								<Button
									onClick={handleStartTournament}
									disabled={!canStartTournament}
									size="lg"
									className="w-full text-lg h-16 font-bold bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-black shadow-xl shadow-orange-500/20 transition-all hover:scale-[1.02]"
								>
									<Trophy className="mr-2 h-6 w-6 fill-current" />
									{t.Game["Begin Tournament"]}
								</Button>
							</div>

						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
