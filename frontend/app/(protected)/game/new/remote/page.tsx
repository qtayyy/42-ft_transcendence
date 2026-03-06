"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ArrowLeft, Gamepad2, Trophy, Swords } from "lucide-react";

export default function RemoteSelectionPage() {
	const router = useRouter();

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
					<div className="inline-flex items-center justify-center p-4 rounded-full bg-green-500/10 mb-2 ring-1 ring-green-500/20">
						<Swords className="h-8 w-8 text-green-500" />
					</div>
					<h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
						Remote Selection
					</h1>
					<p className="text-lg text-muted-foreground max-w-xl mx-auto">
						Choose your online path.
					</p>
				</div>

				<div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
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
								<p className="text-sm text-muted-foreground">Create, join, or quick match</p>
							</CardContent>
						</Card>
					</div>

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
								<p className="text-sm text-muted-foreground">3-8 Players • Online Competition</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
