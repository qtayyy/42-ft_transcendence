"use client";

import { useGameContext, useGameDispatch as useGameDispatchContext } from "@/context/game-context";

export const useGame = () => useGameContext();
export const useGameDispatch = () => useGameDispatchContext();
