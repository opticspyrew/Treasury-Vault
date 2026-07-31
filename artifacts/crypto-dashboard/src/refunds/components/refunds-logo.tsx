interface RefundsLogoProps {
  size?: number;
  showWordmark?: boolean;
  animateUnlock?: boolean;
  className?: string;
}

export default function RefundsLogo({
  size = 36,
  showWordmark = true,
  animateUnlock = false,
  className = "",
}: RefundsLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className={`inline-flex items-center justify-center ${animateUnlock ? "refunds-vault-lock" : ""}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 40 40" width={size} height={size} role="img">
          <defs>
            <linearGradient id="refunds-logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="hsl(180 95% 55%)" />
              <stop offset="100%" stopColor="hsl(217 91% 60%)" />
            </linearGradient>
          </defs>
          <path
            d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z"
            fill="hsl(220 60% 5%)"
            stroke="url(#refunds-logo-grad)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="20" r="7.5" fill="none" stroke="url(#refunds-logo-grad)" strokeWidth="1.4" />
          <circle cx="20" cy="20" r="2.2" fill="url(#refunds-logo-grad)" />
          <line x1="20" y1="9" x2="20" y2="12.2" stroke="url(#refunds-logo-grad)" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="20" y1="27.8" x2="20" y2="31" stroke="url(#refunds-logo-grad)" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="9" y1="20" x2="12.2" y2="20" stroke="url(#refunds-logo-grad)" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="27.8" y1="20" x2="31" y2="20" stroke="url(#refunds-logo-grad)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className="text-[15px] font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--app-font-sans)", letterSpacing: "-0.01em" }}
          >
            Netspy-World
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80 mt-0.5"
            style={{ fontFamily: "var(--app-font-sans)" }}
          >
            Forensics
          </span>
        </span>
      )}
    </div>
  );
}
