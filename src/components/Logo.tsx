export function Logo({
  size = 24,
  bg = true,
  className,
}: {
  size?: number;
  bg?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {bg ? <rect width="200" height="200" rx="40" fill="#f8fafc" /> : null}
      <path
        d="M40 140 A 80 80 0 1 1 160 140"
        fill="none"
        stroke={bg ? "#334155" : "currentColor"}
        strokeWidth={16}
        strokeLinecap="round"
      />
      <path
        d="M100 140 L140 70"
        stroke="#f59e0b"
        strokeWidth={12}
        strokeLinecap="round"
      />
      <circle cx="100" cy="140" r="15" fill="#f59e0b" />
    </svg>
  );
}
