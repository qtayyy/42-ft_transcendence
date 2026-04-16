"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Lock } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function Achievements() {
  const { t } = useTranslation();
  const tA = t?.["Leaderboard & Match History"];
  const tDefs = (tA as any)?.["AchievementDefs"] as Record<string, { name: string; description: string }> | undefined;
  const [unlocked, setUnlocked] = useState<any[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const [u, d] = await Promise.all([
          axios.get("/api/achievements"),
          axios.get("/api/achievements/definitions"),
        ]);
        setUnlocked(u.data);
        setDefinitions(d.data);
      } catch (error) {
        console.error("Failed to load achievements", error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading) return <p className="text-muted-foreground text-center">{tA?.["Loading achievements..."] || "Loading achievements..."}</p>;

  const unlockedKeys = new Set(unlocked.map((a) => a.key));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {definitions.map((a) => {
          const isUnlocked = unlockedKeys.has(a.key);
          const unlockedData = unlocked.find((u) => u.key === a.key);
          const date = unlockedData ? new Date(unlockedData.unlockedAt).toLocaleDateString() : null;

          return (
            <div
              key={a.key}
              className={`rounded-lg border p-3 flex flex-col items-center gap-2 ${isUnlocked
                  ? "bg-muted/30 border-border/50"
                  : "bg-muted/10 border-muted/30 opacity-60"
                }`}
            >
              <div className={`text-3xl ${isUnlocked ? "scale-110" : "scale-90"}`}>
                {a.icon}
              </div>
              <p className="font-semibold text-sm text-center">{tDefs?.[a.key]?.name ?? a.name}</p>
              <p className="text-xs text-muted-foreground text-center">{tDefs?.[a.key]?.description ?? a.description}</p>
              {isUnlocked && date ? (
                <p className="text-xs text-primary/70">{date}</p>
              ) : (
                <Lock className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground text-center">
        {unlocked.length} / {definitions.length} {tA?.["achievements"] || "achievements"}
      </p>
    </div>
  );
}
