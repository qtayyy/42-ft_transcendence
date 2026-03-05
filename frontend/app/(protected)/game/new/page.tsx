"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Users, Monitor, Gamepad2, Trophy, ArrowLeft, Swords, Globe, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/languageContext";

export default function NewGamePage() {
	const router = useRouter();
	const { t } = useLanguage();
	const [selectedMode, setSelectedMode] = useState<"local" | "remote" | null>(null);

	const handleModeSelect = (mode: "local" | "remote") => {
		setSelectedMode(mode);
	};

	const handleBack = () => {
		setSelectedMode(null);
	};

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-5xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
				
				{/* Header Section */}
				<div className="text-center space-y-4">
					<div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-4 ring-1 ring-primary/20">
						<Zap className="h-6 w-6 text-primary animate-pulse" />
					</div>
					<h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-white via-primary/50 to-white bg-clip-text text-transparent pb-2">
						{t.Game["Are You Ready?"]}
					</h1>
					<p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
						{t.Game["Choose your arena. Dominate the court."]}
					</p>
				</div>

				{!selectedMode ? (
					// Step 1: Choose Local or Remote
					<div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
						{/* Local Play Card */}
						<div className="group relative">
							<div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
							<Card 
								className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.02]"
								onClick={() => handleModeSelect("local")}
							>
								<div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
									<Monitor className="h-32 w-32 -mr-8 -mt-8" />
								</div>
								<CardHeader className="text-center pb-2">
									<div className="mx-auto p-4 rounded-2xl bg-blue-500/10 mb-4 group-hover:bg-blue-500/20 transition-colors">
										<Monitor className="h-10 w-10 text-blue-500" />
									</div>
									<CardTitle className="text-3xl font-bold">{t.Game["Local Play"]}</CardTitle>
									<CardDescription className="text-base">{t.Game["Same device multiplayer"]}</CardDescription>
								</CardHeader>
								<CardContent className="text-center space-y-4">
									<div className="space-y-2">
										<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
											<Swords className="h-4 w-4" /> {t.Game["1v1 Matches"]}
										</div>
										<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
											<Trophy className="h-4 w-4" /> {t.Game.Tournament}
										</div>
									</div>
									<Button variant="outline" className="w-full border-blue-500/20 hover:bg-blue-500/10 hover:text-blue-500">
										{t.Game["Select local"]}
									</Button>
								</CardContent>
							</Card>
						</div>

						{/* Remote Play Card */}
						<div className="group relative">
							<div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
							<Card 
								className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.02]"
								onClick={() => handleModeSelect("remote")}
							>
								<div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
									<Globe className="h-32 w-32 -mr-8 -mt-8" />
								</div>
								<CardHeader className="text-center pb-2">
									<div className="mx-auto p-4 rounded-2xl bg-green-500/10 mb-4 group-hover:bg-green-500/20 transition-colors">
										<Users className="h-10 w-10 text-green-500" />
									</div>
									<CardTitle className="text-3xl font-bold">{t.Game["Remote Play"]}</CardTitle>
									<CardDescription className="text-base">{t.Game["Online Multiplayer"]}</CardDescription>
								</CardHeader>
								<CardContent className="text-center space-y-4">
									<div className="space-y-2">
										<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
											<Globe className="h-4 w-4" /> {t.Game["Online Matchmaking"]}
										</div>
										<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
											<Users className="h-4 w-4" /> {t.Game["Play with friends"]}
										</div>
									</div>
									<Button variant="outline" className="w-full border-green-500/20 hover:bg-green-500/10 hover:text-green-500">
										{t.Game["Select remote"]}
									</Button>
								</CardContent>
							</Card>
						</div>
					</div>
				) : selectedMode === "local" ? (
					// Step 2: Local Play Options
					<div className="space-y-8 animate-in zoom-in-95 duration-500">
						<div className="flex justify-center">
							<Button 
								variant="ghost" 
								onClick={handleBack}
								className="gap-2 text-muted-foreground hover:text-foreground"
							>
								<ArrowLeft className="h-4 w-4" />
								{t.Game["Back to Modes"]}
							</Button>
						</div>

						<div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
							{/* Single Match */}
							<div className="group relative">
								<div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
								<Card 
									className="relative cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
									onClick={() => router.push("/game/local/single")}
								>
									<CardHeader className="text-center">
										<div className="mx-auto p-3 rounded-xl bg-purple-500/10 mb-3">
											<Gamepad2 className="h-8 w-8 text-purple-500" />
										</div>
										<CardTitle className="text-2xl">{t.Game["Single Match"]}</CardTitle>
										<CardDescription>{t.Game["Classic 1v1 Duel"]}</CardDescription>
									</CardHeader>
									<CardContent className="text-center pb-8">
										<p className="text-sm text-muted-foreground">
											{t.Game["Quick Match"]}
										</p>
									</CardContent>
								</Card>
							</div>

							{/* Tournament */}
							<div className="group relative">
								<div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
								<Card 
									className="relative cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
									onClick={() => router.push("/game/local/tournament")}
								>
									<CardHeader className="text-center">
										<div className="mx-auto p-3 rounded-xl bg-yellow-500/10 mb-3">
											<Trophy className="h-8 w-8 text-yellow-500" />
										</div>
										<CardTitle className="text-2xl">{t.Game.Tournament}</CardTitle>
										<CardDescription>{t.Game["Bracket Elimination"]}</CardDescription>
									</CardHeader>
									<CardContent className="text-center pb-8">
										<p className="text-sm text-muted-foreground">
											{t.Game["4-8 Player"]} • {t.Game["Final Championship"]}
										</p>
									</CardContent>
								</Card>
							</div>
						</div>
					</div>
				) : (
					// Step 2: Remote Play Options
					<div className="space-y-8 animate-in zoom-in-95 duration-500">
						<div className="flex justify-center">
							<Button 
								variant="ghost" 
								onClick={handleBack}
								className="gap-2 text-muted-foreground hover:text-foreground"
							>
								<ArrowLeft className="h-4 w-4" />
								Return to Mode Selection
							</Button>
						</div>

						<div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
							{/* Single Match */}
							<div className="group relative">
								<div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
								<Card 
									className="relative cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
									onClick={() => router.push("/game/remote/single")}
								>
									<CardHeader className="text-center">
										<div className="mx-auto p-3 rounded-xl bg-green-500/10 mb-3">
											<Gamepad2 className="h-8 w-8 text-green-500" />
										</div>
										<CardTitle className="text-2xl">Single Match</CardTitle>
										<CardDescription>Online 1v1 Duel</CardDescription>
									</CardHeader>
									<CardContent className="text-center pb-8">
										<p className="text-sm text-muted-foreground">
											Create, join, or quick match
										</p>
									</CardContent>
								</Card>
							</div>

							{/* Tournament */}
							<div className="group relative">
								<div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
								<Card 
									className="relative cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
									onClick={() => router.push("/game/remote/tournament")}
								>
									<CardHeader className="text-center">
										<div className="mx-auto p-3 rounded-xl bg-yellow-500/10 mb-3">
											<Trophy className="h-8 w-8 text-yellow-500" />
										</div>
										<CardTitle className="text-2xl">Tournament</CardTitle>
										<CardDescription>Online Bracket</CardDescription>
									</CardHeader>
									<CardContent className="text-center pb-8">
										<p className="text-sm text-muted-foreground">
											3-8 Players • Online Competition
										</p>
									</CardContent>
								</Card>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
