import { config } from "@/config/app";

type BrandLogoProps = {
  iconSize?: number;
  showText?: boolean;
  textClassName?: string;
  className?: string;
};

export function BrandLogo({
  iconSize = 28,
  showText = true,
  textClassName,
  className,
}: BrandLogoProps) {
  return (
    <div className={className || "flex items-center gap-2.5"}>
      <div
        className="rounded-md border border-amber-500/25 bg-amber-500/10"
        style={{
          width: iconSize,
          height: iconSize,
          backgroundImage: "url('/brand-logo.svg')",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "82% 82%",
        }}
        aria-hidden
      />
      {showText ? (
        <span
          className={textClassName || "text-[15px] font-bold tracking-[-0.03em]"}
          style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {config.APP_NAME}
        </span>
      ) : null}
    </div>
  );
}
