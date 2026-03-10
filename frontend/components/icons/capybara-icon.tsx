import { cn } from "@/lib/utils";

interface CapybaraIconProps {
  className?: string;
}

export function CapybaraIcon({ className }: CapybaraIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-6", className)}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.5 14.2C3.5 11 6.1 8.4 9.3 8.4h6.5c2.6 0 4.7 2.1 4.7 4.7v1.5c0 2.8-2.2 5-5 5H8.5c-2.8 0-5-2.2-5-5v-.4Z" />
        <path d="M8.4 8.5v-1c0-1.7 1.4-3.1 3.1-3.1h2.6c1.3 0 2.4 1.1 2.4 2.4v1.6" />
        <circle cx="10.4" cy="5.7" r="0.9" />
        <circle cx="13.6" cy="5.4" r="0.8" />
        <circle cx="14.6" cy="12.2" r="0.35" fill="currentColor" />
        <path d="M18.2 12.6h1.2" />
        <path d="M8.4 19.6v1.3M12.1 19.6v1.3M16 19.6v1.3" />
      </g>
    </svg>
  );
}
