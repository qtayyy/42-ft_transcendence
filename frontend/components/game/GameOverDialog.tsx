import React from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { GameState } from "@/types/game";
import { formatTime } from "@/utils/gameHelpers";

interface GameOverDialogProps {
    gameState: GameState | null;
    open: boolean;
    onExit?: () => void;
}

export function GameOverDialog({ gameState, open, onExit }: GameOverDialogProps) {
    if (!gameState) return null;

    return (
        <Dialog open={open}>
            <DialogContent className="sm:max-w-md border-2 border-primary/20 bg-card shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-center text-3xl font-bold tracking-tight mb-2">
                        {gameState.result === 'draw' ? (
                            <span className="text-muted-foreground">Match Draw</span>
                        ) : (
                            <span className="text-primary flex items-center justify-center gap-2">
                                <Trophy className="h-8 w-8 text-yellow-500" />
                                Player {gameState.winner} Wins!
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-center text-lg">
                        Match Duration: {gameState.timer ? formatTime(gameState.constant.matchDuration - gameState.timer.timeRemaining) : "0:00"}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex justify-center items-center gap-8 py-8 px-4 bg-muted/30 rounded-xl my-4">
                    <div className={`text-center flex-1 ${gameState.winner === 1 ? 'scale-110 transition-transform' : 'opacity-70'}`}>
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Player 1</p>
                        <p className={`text-6xl font-black ${gameState.winner === 1 ? 'text-primary' : ''}`}>
                            {gameState.score.p1}
                        </p>
                        {gameState.winner === 1 && <p className="text-xs text-yellow-500 font-bold mt-1">WINNER</p>}
                    </div>
                    
                    <div className="text-4xl font-light text-muted-foreground/30">/</div>
                    
                    <div className={`text-center flex-1 ${gameState.winner === 2 ? 'scale-110 transition-transform' : 'opacity-70'}`}>
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Player 2</p>
                        <p className={`text-6xl font-black ${gameState.winner === 2 ? 'text-primary' : ''}`}>
                            {gameState.score.p2}
                        </p>
                        {gameState.winner === 2 && <p className="text-xs text-yellow-500 font-bold mt-1">WINNER</p>}
                    </div>
                </div>

                <DialogFooter className="sm:justify-center">
                    <Button 
                        onClick={onExit} 
                        size="lg" 
                        className="w-full font-bold text-lg h-12 shadow-md hover:scale-[1.02] transition-transform"
                    >
                        Continue to Menu
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
