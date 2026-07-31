import { useMemo, useRef, useState } from "react";
import { FileCheck2, FileText, FileUp, Hash, ShieldCheck } from "lucide-react";
import { getCustodyLog, getEvidence } from "../../data/mocks";
import type { EvidenceFile, EvidenceStatus } from "../../data/types";

function fmtSize(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

const STATUS_TONE: Record<EvidenceStatus, string> = {
  verified: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  verifying: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  uploaded: "bg-card text-muted-foreground border-card-border",
  flagged: "bg-red-500/10 text-red-300 border-red-500/30",
};

function fakeHash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Array.from({ length: 32 }, (_, i) => ((Math.abs(h) + i * 7) % 16).toString(16))
    .join("")
    .padEnd(64, "0")
    .slice(0, 64);
}

export default function EvidenceUpload() {
  const initial = useMemo(() => getEvidence(), []);
  const custody = useMemo(() => getCustodyLog(), []);
  const [files, setFiles] = useState<EvidenceFile[]>(initial);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: EvidenceFile[] = Array.from(list).map((f) => ({
      id: `local-${Date.now()}-${f.name}`,
      caseRef: "RF-2026-0184",
      name: f.name,
      sizeBytes: f.size,
      sha256: fakeHash(f.name + f.size),
      uploadedBy: "You",
      uploadedAt: new Date().toISOString(),
      status: "verifying" as const,
    }));
    setFiles((prev) => [...next, ...prev]);
    window.setTimeout(() => {
      setFiles((prev) =>
        prev.map((f) =>
          next.some((n) => n.id === f.id) ? { ...f, status: "verified" as const } : f,
        ),
      );
    }, 1100);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <section className="xl:col-span-2 refunds-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Evidence vault</h2>
        </div>

        <label
          htmlFor="evidence-input"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center ${
            dragOver ? "border-primary bg-primary/10" : "border-card-border bg-card/40 hover:border-primary/40"
          }`}
        >
          <FileUp className="w-6 h-6 text-primary" />
          <span className="text-sm font-medium text-foreground">Drop evidence files or click to browse</span>
          <span className="text-xs text-muted-foreground">
            Each file is hashed (SHA-256) and added to the chain-of-custody log.
          </span>
          <input
            id="evidence-input"
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>

        <ul className="divide-y divide-card-border/70">
          {files.map((f) => (
            <li key={f.id} className="py-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-card border border-card-border flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${STATUS_TONE[f.status]}`}
                  >
                    {f.status}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {fmtSize(f.sizeBytes)} • {f.uploadedBy} • {fmtTime(f.uploadedAt)}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground/80 mt-1 break-all flex items-center gap-1">
                  <Hash className="w-3 h-3 flex-shrink-0" /> {f.sha256.slice(0, 32)}…
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="refunds-glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Chain of custody</h2>
        </div>
        <ol className="space-y-3 relative">
          <span className="absolute left-2.5 top-2 bottom-2 w-px bg-card-border" aria-hidden="true" />
          {custody.map((c) => (
            <li key={c.id} className="pl-7 relative">
              <span className="absolute left-1.5 top-1.5 w-2.5 h-2.5 rounded-full bg-primary/80 border-2 border-card" />
              <p className="text-sm text-foreground">{c.action}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.actor}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5 font-mono">
                {fmtTime(c.at)}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
