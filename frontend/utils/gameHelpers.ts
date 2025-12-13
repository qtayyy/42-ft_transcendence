export function getPowerUpColor(type: string): string {
	switch (type) {
		case 'SPEED_UP': return '#ef4444'; // Red
		case 'SPEED_DOWN': return '#3b82f6'; // Blue
		case 'SIZE_UP': return '#22c55e'; // Green
		case 'SIZE_DOWN': return '#eab308'; // Yellow
		default: return '#ccc';
	}
}

export function getEffectColor(type: string): string {
	switch (type) {
		case 'SPEED_UP': return '#fca5a5'; // Light Red
		case 'SPEED_DOWN': return '#93c5fd'; // Light Blue
		case 'SIZE_UP': return '#86efac'; // Light Green
		case 'SIZE_DOWN': return '#fde047'; // Light Yellow
		default: return '#fff';
	}
}

export function getPowerUpSymbol(type: string): string {
	switch (type) {
		case 'SPEED_UP': return '⚡+';
		case 'SPEED_DOWN': return '⚡-';
		case 'SIZE_UP': return '○+';
		case 'SIZE_DOWN': return '○-';
		default: return '?';
	}
}

export const formatTime = (ms: number): string => {
	const totalSeconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
