"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, LogIn, Trophy, Users, Crown, ShieldQuestion } from "lucide-react";
import { useSocketContext } from "@/context/socket-context";

export default function RemoteTournamentPrivatePage() {
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
						onClick={() => router.push("/game/remote/tournament")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Selection
					</Button>
				</div>

				{/* Title Section */}
				<div className="text-center space-y-4">
					<div className="inline-flex items-center justify-center p-4 rounded-full bg-emerald-500/10 mb-2 ring-1 ring-emerald-500/20">
						<Crown className="h-8 w-8 text-emerald-500" />
					</div>
					<h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
						Private Tournament
					</h1>
					<p className="text-lg text-muted-foreground max-w-xl mx-auto">
						Organize an invite-only championship for you and your friends.
					</p>
				</div>

				{/* Options Grid */}
				<div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
					{/* Create Room */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => handleNavigate("/game/remote/tournament/create")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<Crown className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-yellow-500/10 mb-3 group-hover:bg-yellow-500/20 transition-colors">
									<Plus className="h-8 w-8 text-yellow-500" />
								</div>
								<CardTitle className="text-2xl">Create Room</CardTitle>
								<CardDescription>Host a tournament</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									Create a tournament room and invite players to compete
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 border border-muted-foreground/20 rounded-full py-1 px-3 w-fit mx-auto">
									<Users className="h-3 w-3" />
									<span>3-8 players bracket</span>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Join Room */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => handleNavigate("/game/remote/tournament/join")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<LogIn className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-emerald-500/10 mb-3 group-hover:bg-emerald-500/20 transition-colors">
									<LogIn className="h-8 w-8 text-emerald-500" />
								</div>
								<CardTitle className="text-2xl">Join Room</CardTitle>
								<CardDescription>Enter tournament code</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									Have a tournament code? Join an existing competition
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 border border-muted-foreground/20 rounded-full py-1 px-3 w-fit mx-auto">
									<Trophy className="h-3 w-3" />
									<span>Join the bracket</span>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Help section */}
				<div className="flex items-center justify-center gap-2 text-muted-foreground text-sm opacity-60">
					<ShieldQuestion className="h-4 w-4" />
					<span>Private tournaments are isolated from the public queue</span>
				</div>
			</div>
		</div>
	);
}
