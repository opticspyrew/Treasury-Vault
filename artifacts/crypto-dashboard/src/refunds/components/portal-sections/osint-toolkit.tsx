import { useMemo, useState } from "react";
import { ExternalLink, Search, ShieldAlert, Wallet } from "lucide-react";
import { inspectAddress, inspectTxHash, type ExplorerLink } from "../../data/osint";

function ResultPanel({
  chain,
  format,
  note,
  explorers,
}: {
  chain: string;
  format: string;
  note: string | null;
  explorers: ExplorerLink[];
}) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30">
          {chain}
        </span>
        <span className="text-xs text-muted-foreground">{format}</span>
      </div>
      {note && <p className="text-xs text-muted-foreground mt-2">{note}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        {explorers.map((ex) => (
          <a
            key={ex.name}
            href={ex.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground border border-card-border rounded-md px-2.5 py-1 hover:bg-card/60 hover:text-primary transition-colors"
          >
            {ex.name} <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

function InvalidPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3" role="alert">
      <p className="text-xs text-destructive">{message}</p>
    </div>
  );
}

export default function OsintToolkit() {
  const [address, setAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const addressResult = useMemo(() => inspectAddress(address), [address]);
  const txResult = useMemo(() => inspectTxHash(txHash), [txHash]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="refunds-glass rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">OSINT toolkit</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Inspect wallet addresses and transaction hashes offline. Detection runs entirely in your
          browser — nothing is sent to a third party — and links straight to the relevant public
          block explorers for deeper review.
        </p>
      </div>

      <div className="refunds-glass rounded-2xl p-5">
        <label
          htmlFor="osint-address"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <Wallet className="w-4 h-4 text-primary" /> Address inspector
        </label>
        <input
          id="osint-address"
          data-testid="osint-address-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x… · bc1… · 1… · T…"
          spellCheck={false}
          autoComplete="off"
          className="mt-3 w-full rounded-lg bg-background/60 border border-card-border px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60"
        />
        {address.trim() && (
          <div className="mt-3" data-testid="osint-address-result">
            {addressResult.valid ? (
              <ResultPanel
                chain={addressResult.chain ?? ""}
                format={addressResult.format ?? ""}
                note={addressResult.note}
                explorers={addressResult.explorers}
              />
            ) : (
              <InvalidPanel message={addressResult.note ?? "Unrecognized format."} />
            )}
          </div>
        )}
      </div>

      <div className="refunds-glass rounded-2xl p-5">
        <label
          htmlFor="osint-tx"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <Search className="w-4 h-4 text-primary" /> Transaction hash inspector
        </label>
        <input
          id="osint-tx"
          data-testid="osint-tx-input"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="0x… (EVM) · 64-char hex (BTC / TRON)"
          spellCheck={false}
          autoComplete="off"
          className="mt-3 w-full rounded-lg bg-background/60 border border-card-border px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60"
        />
        {txHash.trim() && (
          <div className="mt-3" data-testid="osint-tx-result">
            {txResult.valid ? (
              <ResultPanel
                chain={txResult.chain ?? ""}
                format={txResult.format ?? ""}
                note={null}
                explorers={txResult.explorers}
              />
            ) : (
              <InvalidPanel message="Not a recognized EVM, Bitcoin, or TRON transaction hash." />
            )}
          </div>
        )}
      </div>

      <div className="refunds-glass rounded-2xl p-5 border-l-2 border-l-primary/50">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Sanctions &amp; risk screening</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Before engaging a counterparty wallet, screen it against published sanctions data — the
          OFAC SDN list includes designated crypto addresses, and major chain-analytics providers
          flag mixers, darknet markets, and known theft clusters. Treat any match as a hard stop and
          escalate through the Legal Coordination workflow.
        </p>
        <ul className="mt-3 space-y-1.5 text-xs">
          <li>
            <a
              className="text-primary hover:underline inline-flex items-center gap-1"
              href="https://sanctionssearch.ofac.treas.gov/"
              target="_blank"
              rel="noopener noreferrer"
            >
              OFAC Sanctions Search <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            <a
              className="text-primary hover:underline inline-flex items-center gap-1"
              href="https://www.chainalysis.com/free-cryptocurrency-sanctions-screening-tools/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Chainalysis sanctions screening <ExternalLink className="w-3 h-3" />
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
