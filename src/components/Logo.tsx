import logoUrl from "../assets/ai_task_manager_logo.png";

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
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt="AI Task Manager"
      draggable={false}
      className={className}
      style={{
        objectFit: "contain",
        padding: bg ? Math.round(size * 0.12) : 0,
        background: bg ? "#f8fafc" : "transparent",
      }}
    />
  );
}
