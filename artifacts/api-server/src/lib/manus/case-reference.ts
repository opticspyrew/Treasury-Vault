// Client-facing case reference helpers (docs/manus-data-sync-requirements.md §5).
//
// Format: RF-<YYYY>-<id zero-padded to 4>, e.g. RF-2026-0001. The year comes
// from the case's creation timestamp (UTC). This mirrors the implementation in
// routes/refunds.ts exactly so a reference produced there resolves here and
// vice-versa. Matching MUST be exact on year+id: parsing the id alone is not
// enough, because RF-9999-0001 and RF-2026-0001 both carry id 1 — the caller
// must re-derive the reference from the row and compare the full string.

export function caseReference(id: number, createdAt: Date): string {
  return `RF-${createdAt.getUTCFullYear()}-${String(id).padStart(4, "0")}`;
}

export function parseCaseReference(
  reference: string,
): { year: number; id: number } | null {
  const match = /^RF-(\d{4})-(\d+)$/.exec(reference.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const id = Number(match[2]);
  if (!Number.isInteger(id) || id <= 0) return null;
  return { year, id };
}
