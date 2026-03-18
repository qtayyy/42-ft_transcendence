/*
===============================================================================
FILE PURPOSE
This module defines shared constants for remote WebSocket Pong matches.
It centralizes gameplay dimensions, timing, and disconnect grace settings.
===============================================================================
*/

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 350;
export const PADDLE_WIDTH = 12;
export const PADDLE_HEIGHT = 80;
export const PADDLE_SPEED = 10;
export const FPS = 60;
export const TICK_MS = 1000 / FPS;
export const BALL_SIZE = 12;
export const WIN_SCORE = 5;
export const MATCH_DURATION = 120000; // 2 minutes in milliseconds
export const POWERUP_SPAWN_INTERVAL = 10000; // Spawn power-up every 10 seconds
export const POWERUP_EFFECT_DURATION = 5000; // Effects last 5 seconds
export const POWERUP_SIZE = 20; // Power-up hitbox size
export const DISCONNECT_GRACE_PERIOD = 30000; // 30 seconds
