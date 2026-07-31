import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import DashboardPreview from "../dashboard-preview";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("DashboardPreview", () => {
  it("renders the portal navigation items", () => {
    const { container } = render(<DashboardPreview />);
    const text = container.textContent ?? "";
    for (const label of [
      "Vault overview",
      "Case intake",
      "Blockchain",
      "Secure messages",
    ]) {
      expect(text).toContain(label);
    }
  });

  it("shows the KPI tiles and recovery timeline", () => {
    const { container } = render(<DashboardPreview />);
    const text = container.textContent ?? "";
    for (const kpi of ["Recovered", "At-risk", "Open cases", "Risk score"]) {
      expect(text).toContain(kpi);
    }
    for (const step of [
      "Intake received",
      "Triage complete",
      "Investigation active",
    ]) {
      expect(text).toContain(step);
    }
  });

  it("offers a call to action to explore the portal", () => {
    const { getByText } = render(<DashboardPreview />);
    expect(getByText(/Explore the portal/i)).not.toBeNull();
  });
});
