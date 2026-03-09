"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ArrowLeft, Gamepad2, Plus, LogIn, Shuffle, Swords, Users, Zap } from "lucide-react";
import { useSocketContext } from "@/context/socket-context";

export default function RemoteSingleMatchPage() {
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
					<div className="inline-flex items-center justify-center p-4 rounded-full bg-green-500/10 mb-2 ring-1 ring-green-500/20">
						<Swords className="h-8 w-8 text-green-500" />
					</div>
					<h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
						Remote 1v1 Arena
					</h1>
					<p className="text-lg text-muted-foreground max-w-xl mx-auto">
						Choose your battleground. Face a random rival or challenge a friend.
					</p>
				</div>

				{/* Options Grid */}
				<div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
					{/* Public Arena */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-5100"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => handleNavigate("/game/remote/single/create?matchmaking=true")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<Zap className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-orange-500/10 mb-3 group-hover:bg-orange-500/20 transition-colors">
									<Shuffle className="h-8 w-8 text-orange-500" />
								</div>
								<CardTitle className="text-2xl">Public Arena</CardTitle>
								<CardDescription>Instant Matchmaking</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									Battle against random opponents worldwide and climb the ranks
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 border border-muted-foreground/20 rounded-full py-1 px-3 w-fit mx-auto">
									<Zap className="h-3 w-3" />
									<span>Jump in now</span>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Private Duel */}
					<div className="group relative">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
						<Card
							className="relative h-full cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]"
							onClick={() => handleNavigate("/game/remote/single/private")}
						>
							<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
								<Users className="h-24 w-24 -mr-6 -mt-6" />
							</div>
							<CardHeader className="text-center pb-2">
								<div className="mx-auto p-4 rounded-xl bg-blue-500/10 mb-3 group-hover:bg-blue-500/20 transition-colors">
									<Plus className="h-8 w-8 text-blue-500" />
								</div>
								<CardTitle className="text-2xl">Private Duel</CardTitle>
								<CardDescription>Play with Friends</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4 pb-8">
								<p className="text-sm text-muted-foreground">
									Create or join a private room using a unique code
								</p>
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 border border-muted-foreground/20 rounded-full py-1 px-3 w-fit mx-auto">
									<Plus className="h-3 w-3" />
									<span>Custom Setup</span>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
