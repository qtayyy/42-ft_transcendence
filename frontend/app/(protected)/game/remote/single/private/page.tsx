"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, LogIn, Swords, Users, ShieldQuestion } from "lucide-react";
import { useLanguage } from "@/context/languageContext";

export default function RemoteSinglePrivatePage() {
	const router = useRouter();
	const { t } = useLanguage();

	const handleNavigate = (path: string) => {
		router.push(path);
	};

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

				{/* Header */}
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						onClick={() => router.push("/game/remote/single")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						{t.Game["Back to Selection"]}
					</Button>
				</div>

				{/* Title Section */}
				<div className="text-center space-y-4">
					<div className="inline-flex items-center justify-center p-4 rounded-full bg-blue-500/10 mb-2 ring-1 ring-blue-500/20">
						<Users className="h-8 w-8 text-blue-500" />
					</div>
					<h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
						{t.Game["Private Duel"]}
					</h1>
					<p className="text-lg text-muted-foreground max-w-xl mx-auto">
						{t.Game["Host a match or join a friend's lobby using a room code."]}
					</p>
				</div>

				{/* Options Grid */}
				<div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
					{/* Create Room */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => handleNavigate("/game/remote/single/create")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<UserPlus className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-blue-500/10 mb-3 group-hover:bg-blue-500/20 transition-colors">
									<UserPlus className="h-8 w-8 text-blue-500" />
								</div>
								<CardTitle className="text-2xl">{t.Game["Create Room"]}</CardTitle>
								<CardDescription>{t.Game["Host a private match"]}</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									{t.Game["Generate a room code and invite a friend to join your game"]}
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
									<Users className="h-3 w-3" />
									<span>{t.Game["Share code with friends"]}</span>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Join Room */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => handleNavigate("/game/remote/single/join")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<LogIn className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-purple-500/10 mb-3 group-hover:bg-purple-500/20 transition-colors">
									<LogIn className="h-8 w-8 text-purple-500" />
								</div>
								<CardTitle className="text-2xl">{t.Game["Join Room"]}</CardTitle>
								<CardDescription>{t.Game["Enter a room code"]}</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									{t.Game["Have a room code? Enter it to join your friend's match"]}
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
									<Swords className="h-3 w-3" />
									<span>{t.Game["Join existing games"]}</span>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Help section */}
				<div className="flex items-center justify-center gap-2 text-muted-foreground text-sm opacity-60">
					<ShieldQuestion className="h-4 w-4" />
					<span>Private matches do not affect your public rank</span>
				</div>
			</div>
		</div>
	);
}
