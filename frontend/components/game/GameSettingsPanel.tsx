"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { KeyBindings } from "@/hooks/usePongGame";
import { BackgroundId, BACKGROUND_OPTIONS } from "@/utils/gameRenderer";

export function formatKey(key: string): string {
	switch (key) {
		case 'ArrowUp':    return '↑';
		case 'ArrowDown':  return '↓';
		case 'ArrowLeft':  return '←';
		case 'ArrowRight': return '→';
		case ' ':          return 'Space';
		default:           return key.toUpperCase();
	}
}

type SettingsTab = 'controls' | 'background';
type RemappingKey = keyof KeyBindings | null;

interface GameSettingsPanelProps {
	bindings: KeyBindings;
	onBindingsChange: (b: KeyBindings) => void;
	background: BackgroundId;
	onBackgroundChange: (id: BackgroundId) => void;
	unlockedAchievements: string[];
	defaultTab?: SettingsTab;
	mode?: 'local' | 'remote';
}

const CONTROLS: { label: string; key: keyof KeyBindings; player: 'P1' | 'P2' }[] = [
	{ label: 'Up',   key: 'p1Up',   player: 'P1' },
	{ label: 'Down', key: 'p1Down', player: 'P1' },
	{ label: 'Up',   key: 'p2Up',   player: 'P2' },
	{ label: 'Down', key: 'p2Down', player: 'P2' },
];

export function GameSettingsPanel({
	bindings,
	onBindingsChange,
	background,
	onBackgroundChange,
	unlockedAchievements,
	defaultTab = 'controls',
	mode = 'local',
}: GameSettingsPanelProps) {
	const [tab, setTab] = useState<SettingsTab>(defaultTab);
	const [remapping, setRemapping] = useState<RemappingKey>(null);

	useEffect(() => {
		if (!remapping) return;
		const handler = (e: KeyboardEvent) => {
			e.preventDefault();
			if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') return;
			onBindingsChange({ ...bindings, [remapping]: e.key });
			setRemapping(null);
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [remapping, bindings, onBindingsChange]);

	return (
		<div className="w-full">
			{/* Tab switcher */}
			<div className="flex rounded-lg overflow-hidden border border-white/10 mb-4">
				{(['controls', 'background'] as SettingsTab[]).map(t => (
					<button
						key={t}
						onClick={() => setTab(t)}
						className={cn(
							"flex-1 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
							tab === t
								? "bg-blue-500/30 text-blue-300"
								: "text-white/40 hover:text-white/70"
						)}
					>
						{t}
					</button>
				))}
			</div>

			{tab === 'controls' && (
				<div className="space-y-3">
					{(mode === 'remote' ? ['P1'] as const : ['P1', 'P2'] as const).map(player => (
						<div key={player} className="space-y-1.5">
							<div className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
								{mode === 'remote' ? 'Your Controls' : player === 'P1' ? 'Player 1' : 'Player 2'}
							</div>
							{CONTROLS.filter(c => c.player === player).map(c => (
								<div key={c.key} className="flex items-center justify-between">
									<span className="text-xs text-white/60">{c.label}</span>
									{remapping === c.key ? (
										<span className="text-[10px] text-yellow-400 animate-pulse font-mono">
											Press any key...
										</span>
									) : (
										<div className="flex items-center gap-2">
											<kbd className="px-2 py-0.5 bg-white/10 rounded text-white font-mono text-xs min-w-10 text-center">
												{formatKey(bindings[c.key])}
											</kbd>
											<button
												onClick={() => setRemapping(c.key)}
												className="text-[10px] text-blue-400 hover:text-blue-300 underline"
											>
												remap
											</button>
										</div>
									)}
								</div>
							))}
						</div>
					))}
					<button
						onClick={() => onBindingsChange({ p1Up: 'w', p1Down: 's', p2Up: 'ArrowUp', p2Down: 'ArrowDown' })}
						className="w-full text-[10px] text-white/30 hover:text-white/60 mt-1 text-right"
					>
						Reset to defaults
					</button>
				</div>
			)}

			{tab === 'background' && (
				<div className="grid grid-cols-2 gap-2">
					{BACKGROUND_OPTIONS.map(opt => {
						const locked = opt.unlockKey !== null && !unlockedAchievements.includes(opt.unlockKey);
						return (
							<button
								key={opt.id}
								disabled={locked}
								onClick={() => !locked && onBackgroundChange(opt.id)}
								className={cn(
									"relative p-2.5 rounded-lg border text-left transition-all",
									background === opt.id
										? "border-blue-400 bg-blue-500/20"
										: locked
											? "border-white/5 bg-white/3 opacity-50 cursor-not-allowed"
											: "border-white/10 bg-white/5 hover:border-white/20"
								)}
							>
								<div className="text-xs font-bold text-white/90">{opt.name}</div>
								<div className="text-[10px] text-white/40 mt-0.5 leading-tight">
									{locked ? `🔒 ${opt.description}` : opt.description}
								</div>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
