"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Users, Monitor, Trophy, Swords, Globe } from "lucide-react";
import { useLanguage } from "@/context/languageContext";
import { CapybaraIcon } from "@/components/icons/capybara-icon";

export default function NewGamePage() {
	const router = useRouter();
	const { t } = useLanguage();

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-5xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="text-center space-y-4">
					<h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-white via-primary/50 to-white bg-clip-text text-transparent pb-2">
						Local or Remote
					</h1>
					<p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
						Choose the play environment first, then pick a mode.
					</p>
				</div>

				<div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.02]"
							onClick={() => router.push("/game/new/local")}
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
									Open Local Selection
								</Button>
							</CardContent>
						</Card>
					</div>

					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.02]"
							onClick={() => router.push("/game/new/remote")}
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
									Open Remote Selection
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
