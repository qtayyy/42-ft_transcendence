"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ArrowLeft, Gamepad2, Trophy, Monitor } from "lucide-react";
import { useLanguage } from "@/context/languageContext";

export default function LocalSelectionPage() {
	const router = useRouter();
	const { t } = useLanguage();

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						onClick={() => router.push("/game/new")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Local or Remote
					</Button>
				</div>

				<div className="text-center space-y-4">
					<div className="inline-flex items-center justify-center p-4 rounded-full bg-blue-500/10 mb-2 ring-1 ring-blue-500/20">
						<Monitor className="h-8 w-8 text-blue-500" />
					</div>
					<h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
						Local Selection
					</h1>
					<p className="text-lg text-muted-foreground max-w-xl mx-auto">
						Pick your local mode on this device.
					</p>
				</div>

				<div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
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
								<p className="text-sm text-muted-foreground">{t.Game["Quick Match"]}</p>
							</CardContent>
						</Card>
					</div>

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
								<p className="text-sm text-muted-foreground">{t.Game["4-8 Player"]} • {t.Game["Final Championship"]}</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
