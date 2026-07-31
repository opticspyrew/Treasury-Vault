/**
 * Unit tests for the Refunds.site mock data read functions.
 *
 * These guard the data seam that the homepage (and portal) consume. The
 * components never touch the raw arrays directly — they only call the get*()
 * functions — so these tests protect:
 *   1. The computed VaultSummary aggregation.
 *   2. The clone-on-read contract (callers can't mutate the underlying data).
 *   3. Lookups and filters (getCase, getMessages, getTimeline).
 *   4. The shape/invariants of the homepage marketing read functions.
 */

import { describe, expect, it } from "vitest";
import {
  getAiThread,
  getAddressRisk,
  getAlerts,
  getBlogArticles,
  getCase,
  getCases,
  getCustodyLog,
  getEcosystemMap,
  getEvidence,
  getFaqEntries,
  getInvestigatorAssignments,
  getMessages,
  getProcessSteps,
  getRecoveryCategories,
  getRecoveryStats,
  getRecoveryTrend,
  getThreads,
  getTimeline,
  getTransactions,
  getVaultSummary,
} from "../mocks";

describe("getVaultSummary", () => {
  it("aggregates totals consistently with getCases()", () => {
    const cases = getCases();
    const summary = getVaultSummary();

    const reportedLossUsd = cases.reduce((s, c) => s + c.reportedLossUsd, 0);
    const recoveredUsd = cases.reduce((s, c) => s + c.recoveredUsd, 0);
    const atRiskUsd = cases.reduce((s, c) => s + c.atRiskUsd, 0);

    expect(summary.totalCases).toBe(cases.length);
    expect(summary.activeCases).toBe(
      cases.filter((c) => c.status !== "closed").length,
    );
    expect(summary.reportedLossUsd).toBe(reportedLossUsd);
    expect(summary.recoveredUsd).toBe(recoveredUsd);
    expect(summary.atRiskUsd).toBe(atRiskUsd);
  });

  it("computes recoveryRatePct as recovered/reported rounded to a whole percent", () => {
    const summary = getVaultSummary();
    const expected = Math.round(
      (summary.recoveredUsd / summary.reportedLossUsd) * 100,
    );
    expect(summary.recoveryRatePct).toBe(expected);
    expect(summary.recoveryRatePct).toBeGreaterThanOrEqual(0);
    expect(summary.recoveryRatePct).toBeLessThanOrEqual(100);
  });

  it("counts only non-info alerts as live alerts", () => {
    const summary = getVaultSummary();
    const expected = getAlerts().filter((a) => a.severity !== "info").length;
    expect(summary.liveAlerts).toBe(expected);
  });
});

describe("getCases / getCase", () => {
  it("returns a defensive copy that callers cannot use to mutate the source", () => {
    const first = getCases();
    first[0].reportedLossUsd = -1;
    first[0].title = "tampered";
    const second = getCases();
    expect(second[0].reportedLossUsd).not.toBe(-1);
    expect(second[0].title).not.toBe("tampered");
  });

  it("looks a case up by its reference", () => {
    const ref = getCases()[0].reference;
    const found = getCase(ref);
    expect(found).toBeDefined();
    expect(found?.reference).toBe(ref);
  });

  it("returns undefined for an unknown reference", () => {
    expect(getCase("RF-DOES-NOT-EXIST")).toBeUndefined();
  });

  it("returns a cloned case (mutation does not leak back)", () => {
    const ref = getCases()[0].reference;
    const found = getCase(ref)!;
    found.title = "tampered";
    expect(getCase(ref)?.title).not.toBe("tampered");
  });
});

describe("getMessages", () => {
  it("returns the messages for a known thread", () => {
    const threads = getThreads();
    const messages = getMessages(threads[0].id);
    expect(messages.length).toBeGreaterThan(0);
    for (const m of messages) {
      expect(m.threadId).toBe(threads[0].id);
    }
  });

  it("returns an empty array (not undefined) for an unknown thread", () => {
    const messages = getMessages("thread-nonexistent");
    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toHaveLength(0);
  });
});

describe("getTimeline", () => {
  it("returns only events for the requested case reference", () => {
    const events = getTimeline("RF-2026-0184");
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.caseRef).toBe("RF-2026-0184");
    }
  });

  it("returns an empty array for a case with no timeline", () => {
    expect(getTimeline("RF-NONE")).toEqual([]);
  });
});

describe("portal read functions return non-empty cloned arrays", () => {
  const readers: Array<[string, () => unknown[]]> = [
    ["getTransactions", getTransactions],
    ["getAddressRisk", getAddressRisk],
    ["getAlerts", getAlerts],
    ["getThreads", getThreads],
    ["getEvidence", getEvidence],
    ["getCustodyLog", getCustodyLog],
    ["getInvestigatorAssignments", getInvestigatorAssignments],
    ["getAiThread", getAiThread],
  ];

  for (const [name, read] of readers) {
    it(`${name} returns a fresh array each call`, () => {
      const a = read();
      const b = read();
      expect(Array.isArray(a)).toBe(true);
      expect(a.length).toBeGreaterThan(0);
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  }
});

describe("homepage marketing read functions", () => {
  it("getProcessSteps returns sequentially numbered steps", () => {
    const steps = getProcessSteps();
    expect(steps.length).toBeGreaterThan(0);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i + 1);
      expect(step.key).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.detail).toBeTruthy();
    });
    const keys = steps.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("getRecoveryCategories returns categories with unique ids and signals", () => {
    const categories = getRecoveryCategories();
    expect(categories.length).toBeGreaterThan(0);
    const ids = categories.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of categories) {
      expect(c.name).toBeTruthy();
      expect(c.icon).toBeTruthy();
      expect(c.signals.length).toBeGreaterThan(0);
    }
  });

  it("getRecoveryStats returns stats with numeric values and unique ids", () => {
    const stats = getRecoveryStats();
    expect(stats.length).toBeGreaterThan(0);
    const ids = stats.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of stats) {
      expect(typeof s.value).toBe("number");
      expect(Number.isNaN(s.value)).toBe(false);
      expect(s.label).toBeTruthy();
    }
  });

  it("getRecoveryTrend returns chronological points with numeric series", () => {
    const trend = getRecoveryTrend();
    expect(trend.length).toBeGreaterThan(0);
    for (const p of trend) {
      expect(p.month).toBeTruthy();
      expect(typeof p.recoveredUsd).toBe("number");
      expect(typeof p.casesOpened).toBe("number");
    }
  });

  it("getBlogArticles returns articles with unique ids and read times", () => {
    const articles = getBlogArticles();
    expect(articles.length).toBeGreaterThan(0);
    const ids = articles.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of articles) {
      expect(a.title).toBeTruthy();
      expect(a.excerpt).toBeTruthy();
      expect(a.readMinutes).toBeGreaterThan(0);
    }
  });

  it("getFaqEntries returns entries with unique ids, questions and answers", () => {
    const faqs = getFaqEntries();
    expect(faqs.length).toBeGreaterThan(0);
    const ids = faqs.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of faqs) {
      expect(f.question).toBeTruthy();
      expect(f.answer).toBeTruthy();
    }
  });

  it("getEcosystemMap returns columns each with at least one link", () => {
    const columns = getEcosystemMap();
    expect(columns.length).toBeGreaterThan(0);
    for (const col of columns) {
      expect(col.heading).toBeTruthy();
      expect(col.links.length).toBeGreaterThan(0);
      for (const link of col.links) {
        expect(link.label).toBeTruthy();
        expect(link.href).toBeTruthy();
      }
    }
  });

  it("returns a fresh clone of marketing data on each call", () => {
    const a = getRecoveryCategories();
    a[0].name = "tampered";
    expect(getRecoveryCategories()[0].name).not.toBe("tampered");
  });
});
