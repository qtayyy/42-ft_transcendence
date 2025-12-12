"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // For notification

export default function createGamePage()
{
	const router = useRouter();

	async function handleCreateGame(mode: "local" | "remote")
	{
		try {
			// Call backend API
			const res = await fetch("http://localhost:3000/api/game/create", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					// Authorisation header is usually handled by auth hook/proxy
				},
				body: JSON.stringify({ mode: mode}),
			});
			
			if (!res.ok)
				throw new Error("Failed to create game");

			const data = await res.json();

			// Redirect to the Game Page using Match ID
			router.push(`/game/${data.matchId}`);

		}
		catch (error) {
			toast.error("Could not start the game");
			console.error(error);
		}
	}

	return (
		<div className="flex flex-col gap-4 items-center justify-center h-full">
			<h1 className="text-3xl font-bold">Choose Game Mode</h1>

			<Button onClick={() => handleCreateGame("local")}>
				Local Play (Shared Keyboard)
			</Button>

			<Button onClick={() => handleCreateGame("remote")}>
				Remote Play (Online)
			</Button>
		</div>
	);
}