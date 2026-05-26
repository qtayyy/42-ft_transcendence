"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Timer, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/gameHelpers";
import { useLanguage } from "@/context/languageContext";

export function LiveStatusBadge({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex items-center gap-1.5 px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5",
				"bg-green-500/5 border border-green-500/20 rounded-full",
				className
			)}
			aria-label="Live"
		>
			<div className="h-2 w-2 shrink-0 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
			<span className="hidden sm:inline text-xs font-bold text-green-500 tracking-wider">
				LIVE
			</span>
		</div>
	);
}

interface MatchGameHeaderProps {
	title: string;
	displayMatchId: string;
	matchSuffix?: string;
	timeRemaining?: number;
	rightSlot: ReactNode;
}

export function MatchGameHeader({
	title,
	displayMatchId,
	matchSuffix,
	timeRemaining,
	rightSlot,
}: MatchGameHeaderProps) {
	const { t } = useLanguage();
	const isLowTime = timeRemaining != null && timeRemaining < 30000;

	const timerBlock =
		timeRemaining != null ? (
			<div className="relative group max-w-full">
				<div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-purple-600 rounded-lg sm:rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500" />
				<div className="relative px-3 py-1 sm:px-6 md:px-8 sm:py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg flex flex-col items-center shadow-2xl min-w-0">
					<div
						className={cn(
							"text-xl sm:text-3xl md:text-4xl font-mono font-bold tabular-nums leading-none",
							"tracking-tight sm:tracking-widest",
							"drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]",
							isLowTime
								? "text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"
								: "bg-clip-text text-transparent bg-linear-to-b from-white to-white/70"
						)}
					>
						{formatTime(timeRemaining)}
					</div>
					<div className="flex items-center gap-1 text-[8px] sm:text-[9px] uppercase font-bold text-muted-foreground/80 tracking-wide sm:tracking-[0.2em] mt-0.5 sm:mt-1">
						<Timer className="h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0" aria-hidden />
						<span className="hidden sm:inline">{t.Game["Time Remaining"]}</span>
					</div>
				</div>
			</div>
		) : null;

	return (
		<div
			className={cn(
				"shrink-0 w-full max-w-7xl mx-auto z-10 transition-all duration-300",
				"border-b border-white/5 bg-background/40 backdrop-blur-md",
				"px-3 py-2 gap-x-2 gap-y-1.5",
				"grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto]",
				"sm:px-8 sm:py-0 sm:h-24 sm:gap-3",
				"sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:grid-rows-1 sm:items-center"
			)}
		>
			<div className="col-start-1 row-start-1 flex min-w-0 flex-col items-start gap-1 sm:gap-1.5">
				<h1 className="hidden sm:block text-2xl font-black tracking-tight bg-clip-text text-transparent bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-sm">
					{title}
				</h1>
				<div className="flex min-w-0 max-w-full items-center gap-1.5 sm:gap-2">
					<Badge
						variant="outline"
						className="inline-flex min-w-0 max-w-full items-center justify-center gap-1 font-mono text-[9px] sm:text-[10px] tracking-wide sm:tracking-widest text-muted-foreground border-white/10 bg-black/20 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full leading-normal"
						title={displayMatchId}
					>
						<Hash className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-50 shrink-0" />
						<span className="truncate">{displayMatchId}</span>
					</Badge>
					{matchSuffix ? (
						<Badge
							variant="secondary"
							className="hidden min-[400px]:inline-flex shrink-0 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 sm:px-2 bg-white/10 text-white/80 border-white/10"
						>
							{matchSuffix.toUpperCase()}
						</Badge>
					) : null}
				</div>
			</div>

			<div className="col-start-2 row-start-1 flex min-w-0 shrink-0 items-center justify-end sm:col-start-3">
				{rightSlot}
			</div>

			{timerBlock ? (
				<div className="col-span-2 row-start-2 flex justify-center sm:col-span-1 sm:col-start-2 sm:row-start-1">
					{timerBlock}
				</div>
			) : null}
		</div>
	);
}
