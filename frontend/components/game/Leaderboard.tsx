import { PlayerStanding } from "@/lib/tournament";
import { Trophy, TrendingUp, Target, Medal, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeaderboardProps {
	standings: PlayerStanding[];
	currentUserId?: string;
}

export default function Leaderboard({ standings, currentUserId }: LeaderboardProps) {
	return (
		<div className="space-y-4">
			{standings.map((standing, index) => {
				const isCurrentUser = standing.playerId === currentUserId;
				const isFirst = index === 0;
				const isSecond = index === 1;
				const isThird = index === 2;

				return (
					<div 
						key={standing.playerId}
						className={cn(
							"relative flex items-center gap-4 p-3 rounded-xl border transition-all duration-300",
							isCurrentUser ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10" : "bg-card/50 border-border/50 hover:bg-card/80",
							isFirst && "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30"
						)}
					>
						{/* Rank Badge */}
						<div className="flex-shrink-0 w-8 flex justify-center">
							{isFirst ? (
								<Crown className="h-6 w-6 text-yellow-500 fill-yellow-500/20" />
							) : isSecond ? (
								<Medal className="h-5 w-5 text-gray-400" />
							) : isThird ? (
								<Medal className="h-5 w-5 text-amber-700" />
							) : (
								<span className="text-sm font-bold text-muted-foreground">#{standing.rank}</span>
							)}
						</div>

						{/* Player Info */}
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className={cn(
									"font-bold truncate",
									isFirst ? "text-lg text-yellow-500" : "text-sm",
									isCurrentUser && !isFirst && "text-primary"
								)}>
									{standing.playerName}
								</span>
								{isCurrentUser && (
									<Badge variant="secondary" className="text-[10px] h-4 px-1">You</Badge>
								)}
								{standing.isTemp && (
									<Badge variant="outline" className="text-[10px] h-4 px-1 border-muted-foreground/30 text-muted-foreground">Guest</Badge>
								)}
							</div>
							<div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
								<span title="Wins-Draws-Losses">
									<span className="text-green-500 font-medium">{standing.wins}</span>W - <span className="text-yellow-500 font-medium">{standing.draws}</span>D - <span className="text-red-500 font-medium">{standing.losses}</span>L
								</span>
							</div>
						</div>

						{/* Stats Columns */}
						<div className="flex items-center gap-2 text-right">
							{/* Avg Score Diff */}
							<div className="hidden sm:block text-xs text-muted-foreground w-14 text-center">
								<div className="text-[10px] uppercase font-bold tracking-wider mb-0.5 text-muted-foreground/60">Avg Diff</div>
								<span className={cn(
									"font-mono font-medium",
									standing.avgScoreDifferential > 0 ? "text-green-500" : standing.avgScoreDifferential < 0 ? "text-red-500" : ""
								)}>
									{standing.avgScoreDifferential > 0 && '+'}{standing.avgScoreDifferential}
								</span>
							</div>

							{/* Avg Total Points Scored */}
							<div className="hidden sm:block text-xs text-muted-foreground w-14 text-center border-l border-border/30 pl-2">
								<div className="text-[10px] uppercase font-bold tracking-wider mb-0.5 text-muted-foreground/60">Avg Pts</div>
								<span className="font-mono font-medium text-foreground/80">
									{standing.avgTotalPointsScored}
								</span>
							</div>

							{/* Match Points (Highlight) */}
							<div className="w-14 text-center bg-background/50 rounded-lg py-1 border border-border/50 shadow-sm ml-2">
								<div className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/70 mb-0.5">Pts</div>
								<span className="text-lg font-black text-primary">
									{standing.matchPoints}
								</span>
							</div>
						</div>
					</div>
				);
			})}
			
			{/* Minimal Legend */}
			<div className="flex flex-wrap justify-between gap-2 px-2 pt-2 text-[10px] text-muted-foreground/50 border-t border-border/30">
				<span>Win: 3 | Draw: 1 | Bye: 3</span>
				<span>Tie-break: Points → Diff → Total Scored</span>
			</div>
		</div>
	);
}
