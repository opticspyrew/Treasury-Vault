// Dev-only gallery for visually checking every ScamThumb logo/glyph mapping.
// Not routed in production builds (see App.tsx).
import { ScamThumb } from "@/lib/scam-thumbnail";
import { CRYPTOS, GIFTCARDS, PAYMENT_FIRMS } from "@/lib/scam-options";

export default function DevScamThumbs() {
  const groups: Array<[string, string[]]> = [
    ["Crypto", CRYPTOS.map((c) => `Crypto: ${c}`)],
    ["Giftcard", GIFTCARDS.map((g) => `Giftcard: ${g}`)],
    ["Payment Firm", PAYMENT_FIRMS.map((p) => `Payment Firm: ${p}`)],
    ["Other", ["Bank Transfer/ACH"]],
  ];
  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200 p-8 space-y-8">
      {groups.map(([title, labels]) => (
        <section key={title}>
          <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-3">{title}</h2>
          <div className="grid grid-cols-3 gap-3 max-w-3xl">
            {labels.map((label) => (
              <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <ScamThumb label={label} size="md" />
                <span className="text-xs text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
