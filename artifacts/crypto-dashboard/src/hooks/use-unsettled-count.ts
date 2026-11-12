// Fan out a request to re-fetch the server-authoritative pending withdrawal count.
// Call only after a server-confirmed request creation or cancellation.
export const UNSETTLED_COUNT_REFRESH_EVENT = "cryptovault:unsettled-count-refresh";

export function refreshUnsettledCount(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNSETTLED_COUNT_REFRESH_EVENT));
  }
}
