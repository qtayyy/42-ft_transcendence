"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Keyboard, Gamepad2, Pause, ChevronDown, ChevronUp } from "lucide-react";

type GameControlsTrayMode = "local" | "remote";

interface GameControlsTrayProps {
	mode: GameControlsTrayMode;
	defaultHidden?: boolean;
	className?: string;
}

export function GameControlsTray({
	mode,
	defaultHidden = true,
	className,
}: GameControlsTrayProps) {
	const [isHidden, setIsHidden] = useState(defaultHidden);

	return (
		<div className={cn("absolute inset-x-0 bottom-4 z-20 px-4", className)}>
			<div className="relative mx-auto w-full max-w-4xl">
				{!isHidden && (
					<div className="pointer-events-auto flex items-center justify-between px-6 py-3 md:px-8 bg-card/70 rounded-full border border-border/50 backdrop-blur-md shadow-lg">
						{mode === "local" ? (
							<>
								<div className="flex items-center gap-3 min-w-0">
									<div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 ring-1 ring-blue-500/20">
										<Keyboard className="h-4 w-4" />
									</div>
									<div className="flex flex-col min-w-0">
										<span className="text-xs font-bold text-foreground">Player 1</span>
										<span className="text-[10px] text-muted-foreground font-mono">W / S</span>
									</div>
								</div>

								<div className="h-6 w-px bg-border/50" />

								<div className="flex flex-col items-center px-2">
									<Pause className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
									<span className="text-[10px] text-muted-foreground font-mono">SPACE</span>
								</div>

								<div className="h-6 w-px bg-border/50" />

								<div className="flex items-center gap-3 text-right min-w-0">
									<div className="flex flex-col items-end min-w-0">
										<span className="text-xs font-bold text-foreground">Player 2</span>
										<span className="text-[10px] text-muted-foreground font-mono">Arrow Keys</span>
									</div>
									<div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 ring-1 ring-purple-500/20">
										<Gamepad2 className="h-4 w-4" />
									</div>
								</div>
							</>
						) : (
							<>
								<div className="flex items-center gap-3 min-w-0">
									<div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 ring-1 ring-green-500/20">
										<Keyboard className="h-4 w-4" />
									</div>
									<div className="flex flex-col min-w-0">
										<span className="text-xs font-bold text-foreground">Your Paddle</span>
										<span className="text-[10px] text-muted-foreground font-mono">
											W / S<span className="hidden sm:inline"> or Arrow Keys</span>
										</span>
									</div>
								</div>

								<div className="h-6 w-px bg-border/50" />

								<div className="flex flex-col items-center px-2">
									<span className="text-xs font-bold text-foreground">Ready</span>
									<span className="text-[10px] text-muted-foreground font-mono">ENTER</span>
								</div>

								<div className="h-6 w-px bg-border/50" />

								<div className="flex items-center gap-3 text-right min-w-0">
									<div className="flex flex-col items-end min-w-0">
										<span className="text-xs font-bold text-foreground">Pause / Resume</span>
										<span className="text-[10px] text-muted-foreground font-mono">SPACE</span>
									</div>
									<div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 ring-1 ring-purple-500/20">
										<Gamepad2 className="h-4 w-4" />
									</div>
								</div>
							</>
						)}
					</div>
				)}

				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => setIsHidden((prev) => !prev)}
					className={cn(
						"absolute right-0 h-9 rounded-full bg-black/60 border-white/10 text-white hover:bg-black/80 hover:text-white",
						isHidden ? "bottom-0" : "bottom-[4.25rem]"
					)}
				>
					{isHidden ? (
						<>
							<ChevronUp className="mr-1.5 h-4 w-4" /> Show Controls
						</>
					) : (
						<>
							<ChevronDown className="mr-1.5 h-4 w-4" /> Hide Controls
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
