"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ArrowLeft, Gamepad2, Plus, LogIn, Shuffle, Swords, Users, Zap } from "lucide-react";

export default function RemoteSingleMatchPage() {
	const router = useRouter();

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
				
				{/* Header */}
				<div className="flex items-center justify-between">
					<Button 
						variant="ghost" 
						onClick={() => router.push("/game/new")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Modes
					</Button>
				</div>

				{/* Title Section */}
				<div className="text-center space-y-4">
					<div className="inline-flex items-center justify-center p-3 rounded-full bg-green-500/10 mb-2 ring-1 ring-green-500/20">
						<Gamepad2 className="h-6 w-6 text-green-500" />
					</div>
					<h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
						Remote Single Match
					</h1>
					<p className="text-lg text-muted-foreground max-w-xl mx-auto">
						Challenge players from around the world in a 1v1 online battle
					</p>
				</div>

				{/* Options Grid */}
				<div className="grid gap-6 md:grid-cols-3">
					{/* Create Room */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
						<Card 
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => router.push("/game/remote/single/create")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<Plus className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-blue-500/10 mb-3 group-hover:bg-blue-500/20 transition-colors">
									<Plus className="h-8 w-8 text-blue-500" />
								</div>
								<CardTitle className="text-2xl">Create Room</CardTitle>
								<CardDescription>Host a private match</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									Generate a room code and invite a friend to join your game
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
									<Users className="h-3 w-3" />
									<span>Share code with friends</span>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Join Room */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
						<Card 
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => router.push("/game/remote/single/join")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<LogIn className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-purple-500/10 mb-3 group-hover:bg-purple-500/20 transition-colors">
									<LogIn className="h-8 w-8 text-purple-500" />
								</div>
								<CardTitle className="text-2xl">Join Room</CardTitle>
								<CardDescription>Enter a room code</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									Have a room code? Enter it to join your friend's match
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
									<Swords className="h-3 w-3" />
									<span>Join existing games</span>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Quick Match */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
						<Card 
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => router.push("/game/remote/single/matchmaking")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<Zap className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-orange-500/10 mb-3 group-hover:bg-orange-500/20 transition-colors">
									<Shuffle className="h-8 w-8 text-orange-500" />
								</div>
								<CardTitle className="text-2xl">Quick Match</CardTitle>
								<CardDescription>Find an opponent</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									Jump into the matchmaking queue and battle a random player
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
									<Zap className="h-3 w-3" />
									<span>Instant matchmaking</span>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
