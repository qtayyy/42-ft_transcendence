"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Plus, LogIn, Shuffle, Users, Crown, Zap } from "lucide-react";
import { useSocketContext } from "@/context/socket-context";

export default function RemoteTournamentPage() {
	const router = useRouter();
	const { forceCleanup } = useSocketContext();

	const handleNavigate = (path: string) => {
		forceCleanup();
		router.push(path);
	};

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

				{/* Header */}
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						onClick={() => router.push("/game/new/remote")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Remote Selection
					</Button>
				</div>

				{/* Title Section */}
				<div className="text-center space-y-4">
					<div className="inline-flex items-center justify-center p-4 rounded-full bg-yellow-500/10 mb-2 ring-1 ring-yellow-500/20">
						<Trophy className="h-8 w-8 text-yellow-500" />
					</div>
					<h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
						Remote Tournament
					</h1>
					<p className="text-lg text-muted-foreground max-w-xl mx-auto">
						Enter the bracket. Choose your path.
					</p>
				</div>

				{/* Options Grid */}
				<div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
					{/* Public Tournament */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => handleNavigate("/game/remote/tournament/matchmaking")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<Zap className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-rose-500/10 mb-3 group-hover:bg-rose-500/20 transition-colors">
									<Shuffle className="h-8 w-8 text-rose-500" />
								</div>
								<CardTitle className="text-2xl">Public Tournament</CardTitle>
								<CardDescription>Global Series</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									Join a public bracket with random players from around the world
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 border border-muted-foreground/20 rounded-full py-1 px-3 w-fit mx-auto">
									<Zap className="h-3 w-3" />
									<span>Auto-filling bracket</span>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Private Tournament */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => handleNavigate("/game/remote/tournament/private")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<Crown className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-emerald-500/10 mb-3 group-hover:bg-emerald-500/20 transition-colors">
									<Plus className="h-8 w-8 text-emerald-500" />
								</div>
								<CardTitle className="text-2xl">Private Tournament</CardTitle>
								<CardDescription>Custom Competition</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									Set up a private bracket for your friends using a room code
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 border border-muted-foreground/20 rounded-full py-1 px-3 w-fit mx-auto">
									<Plus className="h-3 w-3" />
									<span>Invite Only</span>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
