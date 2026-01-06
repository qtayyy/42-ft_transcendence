"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, LogIn, Loader2, AlertCircle } from "lucide-react";

export default function JoinRoomPage() {
	const router = useRouter();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const [roomCode, setRoomCode] = useState("");
	const [joining, setJoining] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleJoin = async () => {
		if (!roomCode.trim() || !user || !isReady) return;
		
		setJoining(true);
		setError(null);

		try {
			// Send join request via WebSocket
			sendSocketMessage({
				event: "JOIN_ROOM_REQUEST",
				payload: {
					roomId: roomCode.trim(),
					userId: user.id,
					username: user.username,
				},
			});

			// Navigate to the room (WebSocket will handle the actual join)
			setTimeout(() => {
				router.push(`/game/room/${roomCode.trim()}`);
			}, 500);
		} catch (err: any) {
			setError(err.message || "Failed to join room");
			setJoining(false);
		}
	};

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
				
				<div className="flex items-center justify-between">
					<Button 
						variant="ghost" 
						onClick={() => router.push("/game/remote/single")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Back
					</Button>
				</div>

				<div className="relative group">
					<div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
						<CardHeader className="text-center pb-4">
							<div className="mx-auto p-4 rounded-full bg-purple-500/10 mb-4 ring-1 ring-purple-500/20">
								<LogIn className="h-8 w-8 text-purple-500" />
							</div>
							<CardTitle className="text-2xl font-bold">Join Room</CardTitle>
							<CardDescription>Enter the room code to join a game</CardDescription>
						</CardHeader>

						<CardContent className="space-y-6">
							<div className="space-y-2">
								<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
									Room Code
								</label>
								<Input
									value={roomCode}
									onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
									placeholder="Enter room code..."
									className="font-mono text-lg text-center tracking-widest h-14"
									onKeyPress={(e) => e.key === "Enter" && handleJoin()}
									disabled={joining}
								/>
							</div>

							{error && (
								<div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
									<AlertCircle className="h-4 w-4 shrink-0" />
									{error}
								</div>
							)}

							<Button
								onClick={handleJoin}
								disabled={!roomCode.trim() || joining}
								size="lg"
								className="w-full text-lg h-14 font-bold bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg shadow-purple-500/20"
							>
								{joining ? (
									<>
										<Loader2 className="mr-2 h-5 w-5 animate-spin" />
										Joining...
									</>
								) : (
									<>
										<LogIn className="mr-2 h-5 w-5" />
										Join Game
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
