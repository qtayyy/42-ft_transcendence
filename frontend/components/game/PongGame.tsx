"use client";

import { useEffect, useRef, useState } from "react";
import { GameState, GameMode } from "@/types/game";

interface PongGameProps {
    matchId: string;
    mode: GameMode;
    // For direct WebSocket mode (local games)
    wsUrl?: string;
    // For context mode (remote/tournament games)
    gameState?: GameState | null;
    onGameOver?: (winner: number | null, score: { p1: number; p2: number }, result: string) => void;
}

export default function PongGame({
    matchId,
    mode,
    wsUrl,
    gameState: externalGameState,
    onGameOver,
}: PongGameProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<WebSocket | null>(null);
    
    // Local game state (for direct WebSocket mode)
    const [localGameState, setLocalGameState] = useState<GameState | null>(null);
    
    // Responsive canvas dimensions
    const [canvasDimensions, setCanvasDimensions] = useState({
        width: 1200,
        height: 600,
    });

    // Determine which game state to use
    const gameState = wsUrl ? localGameState : externalGameState;

    // Setup responsive canvas sizing
    useEffect(() => {
        const updateCanvasSize = () => {
            if (!containerRef.current) return;

            const container = containerRef.current;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            // Maintain 2:1 aspect ratio
            const aspectRatio = 2;
            let width = Math.max(containerWidth - 40, 800); // padding, minimum 800px
            let height = width / aspectRatio;

            // If height exceeds container, scale down
            if (height > containerHeight - 200) {
                height = Math.max(containerHeight - 200, 400); // minimum 400px
                width = height * aspectRatio;
            }

            // Cap maximum dimensions
            width = Math.min(width, 1200);
            height = width / aspectRatio;

            setCanvasDimensions({ width, height });
        };

        updateCanvasSize();

        // Use ResizeObserver for better performance
        const resizeObserver = new ResizeObserver(updateCanvasSize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Initialize WebSocket Connection (for direct mode)
    useEffect(() => {
        if (!wsUrl) return; // Skip if using context mode

        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log(`Connected to Game Server (Match: ${matchId})`);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "GAME_OVER") {
                    if (onGameOver) {
                        onGameOver(data.winner, data.score, data.result || 'win');
                    }
                    const message = data.result === 'draw' 
                        ? "Game Over! It's a DRAW!" 
                        : `Game Over! Winner: Player ${data.winner}`;
                    alert(message);
                } else {
                    setLocalGameState(data);
                }
            } catch (e) {
                console.error("WebSocket parse error:", e);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
            console.log("WebSocket connection closed");
        };

        socketRef.current = ws;

        return () => {
            ws.close();
        };
    }, [wsUrl, matchId, onGameOver]);

    // Handle Keyboard Input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
                return;
            }

            let payload: any = null;

            // Player 1 controls (W/S)
            if (e.key === "w" || e.key === "W") {
                payload = {
                    type: "PADDLE_MOVE",
                    direction: "UP",
                    player: 1,
                };
            } else if (e.key === "s" || e.key === "S") {
                payload = {
                    type: "PADDLE_MOVE",
                    direction: "DOWN",
                    player: 1,
                };
            }
            // Player 2 controls (Arrow keys)
            else if (e.key === "ArrowUp") {
                payload = {
                    type: "PADDLE_MOVE",
                    direction: "UP",
                    player: 2,
                };
            } else if (e.key === "ArrowDown") {
                payload = {
                    type: "PADDLE_MOVE",
                    direction: "DOWN",
                    player: 2,
                };
            }
            // Start game
            else if (e.key === "Enter") {
                payload = {
                    type: "START",
                };
            }

            if (payload) {
                socketRef.current.send(JSON.stringify(payload));
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
                return;
            }

            let payload: any = null;

            if (e.key === "w" || e.key === "W" || e.key === "s" || e.key === "S") {
                payload = {
                    type: "PADDLE_MOVE",
                    direction: null,
                    player: 1,
                };
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                payload = {
                    type: "PADDLE_MOVE",
                    direction: null,
                    player: 2,
                };
            }

            if (payload) {
                socketRef.current.send(JSON.stringify(payload));
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    // Render Game
    useEffect(() => {
        if (!gameState || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        // Calculate scale factor based on actual canvas size vs game state size
        const scaleX = canvasDimensions.width / gameState.constant.canvasWidth;
        const scaleY = canvasDimensions.height / gameState.constant.canvasHeight;

        // Clear canvas
        context.fillStyle = "#000000"; // Black background
        context.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);

        // Draw center line
        context.setLineDash([10 * scaleX, 10 * scaleX]);
        context.beginPath();
        context.moveTo(canvasDimensions.width / 2, 0);
        context.lineTo(canvasDimensions.width / 2, canvasDimensions.height);
        context.strokeStyle = "rgba(255, 255, 255, 0.3)";
        context.lineWidth = 2;
        context.stroke();
        context.setLineDash([]);

        // Draw Paddles (white)
        context.fillStyle = "white";
        context.fillRect(
            gameState.paddles.p1.x * scaleX,
            gameState.paddles.p1.y * scaleY,
            gameState.constant.paddleWidth * scaleX,
            gameState.constant.paddleHeight * scaleY
        );
        context.fillRect(
            gameState.paddles.p2.x * scaleX,
            gameState.paddles.p2.y * scaleY,
            gameState.constant.paddleWidth * scaleX,
            gameState.constant.paddleHeight * scaleY
        );

        // Draw Ball (white circle)
        context.fillStyle = "white";
        context.beginPath();
        const ballRadius = (gameState.constant.ballSize / 2) * scaleX;
        context.arc(
            (gameState.ball.x + gameState.constant.ballSize / 2) * scaleX,
            (gameState.ball.y + gameState.constant.ballSize / 2) * scaleY,
            ballRadius,
            0,
            Math.PI * 2
        );
        context.fill();

        // Draw Scores (scaled font)
        const fontSize = Math.max(32, 48 * scaleX);
        context.font = `bold ${fontSize}px Arial`;
        context.fillStyle = "white";
        const centerX = canvasDimensions.width / 2;
        
        // Player 1 score (left)
        context.textAlign = "right";
        context.fillText(
            `${gameState.score.p1}`,
            centerX - 30 * scaleX,
            60 * scaleY
        );
        
        // Player 2 score (right)
        context.textAlign = "left";
        context.fillText(
            `${gameState.score.p2}`,
            centerX + 30 * scaleX,
            60 * scaleY
        );
    }, [gameState, canvasDimensions]);

    // Format timer display (MM:SS)
    const formatTime = (ms: number): string => {
        const totalSeconds = Math.ceil(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div
            ref={containerRef}
            className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4"
        >
            <div className="flex items-center justify-between w-full max-w-6xl mb-4">
                <h1 className="text-2xl font-bold">
                    {mode === "local" && "Local Match"}
                    {mode === "remote" && "Remote Match"}
                    {mode === "tournament" && "Tournament Match"}
                </h1>
                
                {/* Timer Display */}
                {gameState?.timer && (
                    <div className="flex flex-col items-center">
                        <div className={`text-4xl font-mono font-bold ${
                            gameState.timer.timeRemaining < 30000 ? 'text-red-500 animate-pulse' : 'text-green-400'
                        }`}>
                            {formatTime(gameState.timer.timeRemaining)}
                        </div>
                        <div className="text-xs text-gray-400">Time Remaining</div>
                    </div>
                )}
                
                <div className="text-sm text-gray-400">
                    Match ID: {matchId.substring(0, 8)}
                </div>
            </div>
            
            <canvas
                ref={canvasRef}
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                className="border-2 border-white bg-gray-900 rounded-lg shadow-2xl"
            />
            
            <div className="mt-6 text-center">
                <p className="text-lg mb-2">
                    <span className="font-semibold">Player 1:</span> W/S{" "}
                    <span className="mx-4">|</span>{" "}
                    <span className="font-semibold">Player 2:</span> Arrow Keys
                </p>
                <p className="text-sm text-gray-400">
                    Press <kbd className="px-2 py-1 bg-gray-700 rounded">Enter</kbd> to start • 
                    Highest score wins when timer expires
                </p>
            </div>

            {gameState?.status === "waiting" && (
                <div className="mt-4 px-6 py-3 bg-yellow-600 text-black rounded-lg font-semibold animate-pulse">
                    Waiting for players...
                </div>
            )}
            
            {gameState?.status === "finished" && (
                <div className="mt-4 px-8 py-4 bg-green-600 text-white rounded-lg font-bold text-xl">
                    {gameState.winner ? `Player ${gameState.winner} Wins!` : "It's a Draw!"}
                </div>
            )}
        </div>
    );
}
