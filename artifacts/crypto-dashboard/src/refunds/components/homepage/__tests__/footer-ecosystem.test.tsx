import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import FooterEcosystem from "../footer-ecosystem";
import { getEcosystemMap } from "../../../data/mocks";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("FooterEcosystem", () => {
  it("renders one labelled nav per ecosystem column", () => {
    const { container } = render(<FooterEcosystem />);
    const columns = getEcosystemMap();
    const navs = Array.from(container.querySelectorAll("nav"));
    expect(navs.length).toBe(columns.length);
    const labels = navs.map((n) => n.getAttribute("aria-label"));
    for (const col of columns) {
      expect(labels).toContain(col.heading);
    }
  });

  it("renders every link in each column as a button", () => {
    const { container } = render(<FooterEcosystem />);
    const columns = getEcosystemMap();
    const totalLinks = columns.reduce((sum, c) => sum + c.links.length, 0);
    const linkButtons = container.querySelectorAll("nav ul li button");
    expect(linkButtons.length).toBe(totalLinks);

    const text = container.textContent ?? "";
    for (const col of columns) {
      expect(text).toContain(col.heading);
      for (const link of col.links) {
        expect(text).toContain(link.label);
      }
    }
  });
});
