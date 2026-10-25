import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${compact ? "compact" : ""}`}
      aria-label="ThirdMind home"
    >
      <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path
          d="M18 4C10 4 6 12 11 18C4 22 8 32 16 31C21 31 23 27 22 23C30 26 35 17 30 11C27 7 22 8 20 11C20 7 19 5 18 4Z"
          fill="currentColor"
        />
        <path
          d="M18 13v10m-5-5h10"
          stroke="#17171b"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <span>
          thirdmind<span className="brand-period">.</span>
        </span>
      )}
    </Link>
  );
}
