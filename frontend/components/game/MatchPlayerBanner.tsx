"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/languageContext";

interface MatchPlayerBannerProps {
	leftName: string;
	rightName: string;
	leftScore?: number;
	rightScore?: number;
	/** Highlight which side is the current user (remote). Omit for local same-keyboard play. */
	mySide?: "LEFT" | "RIGHT" | null;
	className?: string;
}

export function MatchPlayerBanner({
	leftName,
	rightName,
	leftScore = 0,
	rightScore = 0,
	mySide = null,
	className,
}: MatchPlayerBannerProps) {
	const { t } = useLanguage();
	const youLabel = t.Game["(You)"];

	return (
		<div
			className={cn(
				"grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 rounded-t-xl border border-b-0 border-white/10 bg-black/50 backdrop-blur-md",
				className,
			)}
		>
			<div
				className={cn(
					"flex items-center gap-2 min-w-0 justify-start",
					mySide === "LEFT" && "text-blue-400",
				)}
			>
				<span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
				<span className="truncate font-bold text-sm sm:text-base">{leftName}</span>
				{mySide === "LEFT" && (
					<span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-blue-400/90">
						{youLabel}
					</span>
				)}
				<span className="shrink-0 tabular-nums text-lg font-black text-white/90 ml-1">
					{leftScore}
				</span>
			</div>

			<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 px-1">
				{t.Game.VS}
			</span>

			<div
				className={cn(
					"flex items-center gap-2 min-w-0 justify-end text-right",
					mySide === "RIGHT" && "text-red-400",
				)}
			>
				<span className="shrink-0 tabular-nums text-lg font-black text-white/90 mr-1">
					{rightScore}
				</span>
				{mySide === "RIGHT" && (
					<span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-red-400/90">
						{youLabel}
					</span>
				)}
				<span className="truncate font-bold text-sm sm:text-base">{rightName}</span>
				<span className="h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
			</div>
		</div>
	);
}
