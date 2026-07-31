import { useLocation } from "wouter";
import { Lock } from "lucide-react";
import RefundsLogo from "../refunds-logo";
import { getEcosystemMap } from "../../data/mocks";
import { refundsGo } from "../../data/nav";

const COLUMNS = getEcosystemMap();

export default function FooterEcosystem() {
  const [location, navigate] = useLocation();

  const handle = (href: string) => {
    refundsGo(href, location, navigate);
  };

  return (
    <footer className="px-6 lg:px-10 pt-14 pb-8 max-w-7xl mx-auto mt-8 border-t border-card-border/60">
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_repeat(4,1fr)] gap-8">
        <div>
          <RefundsLogo size={34} />
          <p className="mt-4 text-sm text-muted-foreground max-w-xs leading-relaxed">
            Enterprise digital investigation, blockchain intelligence, and asset
            recovery — operated under formal forensic controls.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-primary" /> Sessions secured with
            AES-256.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <p className="text-[11px] uppercase tracking-wider text-foreground font-semibold mb-3">
              {col.heading}
            </p>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <button
                    onClick={() => handle(l.href)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors text-left"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-10 pt-6 border-t border-card-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          © 2026 NETSPYWORLD FORENSICS LTD — synthetic demonstration data.
        </span>
        <span className="text-[11px] text-muted-foreground max-w-md sm:text-right">
          Netspy-World Forensics does not custody assets and cannot reverse
          on-chain transactions. Outcomes depend on jurisdiction and counterparty
          cooperation.
        </span>
      </div>
    </footer>
  );
}
