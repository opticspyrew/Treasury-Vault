// Route-safe navigation for the public Refunds.site marketing surface.
//
// The marketing pages live at real routes (/refunds/services, ...), while the
// landing page exposes in-page anchors (#process, #faq, ...). A link like
// `#process` dead-ends on a sub-page because that section is not mounted there.
// `refundsGo` normalizes every link so anchors always resolve against the
// landing page: it routes to the landing page first when needed, then scrolls
// to the target section. Pure routes navigate directly.

const LANDING_PATH = "/refunds";

export function refundsGo(
  rawHref: string,
  location: string,
  navigate: (to: string) => void,
): void {
  // A bare "#section" anchor belongs to the landing page.
  const href = rawHref.startsWith("#") ? `${LANDING_PATH}${rawHref}` : rawHref;

  const hashIndex = href.indexOf("#");
  const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);

  if (!hash) {
    navigate(path);
    return;
  }

  const scrollToHash = () => {
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (location === path) {
    scrollToHash();
  } else {
    navigate(path);
    // Let the destination page mount before scrolling to the anchor.
    window.setTimeout(scrollToHash, 120);
  }
}
