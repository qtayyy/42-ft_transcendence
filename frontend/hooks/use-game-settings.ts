"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { defaultBindings, type KeyBindings } from "@/hooks/usePongGame";
import type { BackgroundId } from "@/utils/gameRenderer";

const LS_BINDINGS = "pongBindings";
const LS_BACKGROUND = "pongBackground";
const LS_AI_DIFFICULTY = "pongAiDifficulty";

type AIDifficulty = "easy" | "medium" | "hard";

function readLocalBindings(): KeyBindings {
  try {
    const raw = localStorage.getItem(LS_BINDINGS);
    return raw ? { ...defaultBindings, ...JSON.parse(raw) } : defaultBindings;
  } catch {
    return defaultBindings;
  }
}

function readLocalBackground(): BackgroundId {
  return (localStorage.getItem(LS_BACKGROUND) as BackgroundId) || "default";
}

function readLocalAiDifficulty(): AIDifficulty {
  const val = localStorage.getItem(LS_AI_DIFFICULTY);
  if (val === "easy" || val === "medium" || val === "hard") return val;
  return "medium";
}

export function useGameSettings() {
  const [bindings, setBindingsState] = useState<KeyBindings>(readLocalBindings);
  const [background, setBackgroundState] = useState<BackgroundId>(readLocalBackground);
  const [aiDifficulty, setAiDifficultyState] = useState<AIDifficulty>(readLocalAiDifficulty);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from DB once on mount
  useEffect(() => {
    apiFetch("/api/game/settings")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data.keyBindings) {
          const merged = { ...defaultBindings, ...data.keyBindings };
          setBindingsState(merged);
          localStorage.setItem(LS_BINDINGS, JSON.stringify(merged));
        }
        if (data.gameBackground) {
          setBackgroundState(data.gameBackground as BackgroundId);
          localStorage.setItem(LS_BACKGROUND, data.gameBackground);
        }
        if (data.aiDifficulty) {
          setAiDifficultyState(data.aiDifficulty as AIDifficulty);
          localStorage.setItem(LS_AI_DIFFICULTY, data.aiDifficulty);
        }
      })
      .catch(() => {/* localStorage values are the fallback */})
      .finally(() => setLoaded(true));
  }, []);

  const persistToDb = useCallback((patch: { keyBindings?: KeyBindings; gameBackground?: string; aiDifficulty?: string }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      apiFetch("/api/game/settings", {
        method: "PUT",
        body: JSON.stringify(patch),
      }).catch(() => {});
    }, 500);
  }, []);

  const setBindings = useCallback((b: KeyBindings) => {
    setBindingsState(b);
    localStorage.setItem(LS_BINDINGS, JSON.stringify(b));
    persistToDb({ keyBindings: b });
  }, [persistToDb]);

  const setBackground = useCallback((id: BackgroundId) => {
    setBackgroundState(id);
    localStorage.setItem(LS_BACKGROUND, id);
    persistToDb({ gameBackground: id });
  }, [persistToDb]);

  const setAiDifficulty = useCallback((d: AIDifficulty) => {
    setAiDifficultyState(d);
    localStorage.setItem(LS_AI_DIFFICULTY, d);
    persistToDb({ aiDifficulty: d });
  }, [persistToDb]);

  return { bindings, setBindings, background, setBackground, aiDifficulty, setAiDifficulty, loaded };
}
