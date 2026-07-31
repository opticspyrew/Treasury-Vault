import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import AnimatedCounter from "../animated-counter";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("AnimatedCounter", () => {
  it("exposes the true value via aria-label with prefix and suffix", () => {
    const { container } = render(
      <AnimatedCounter value={482} prefix="$" suffix="M" />,
    );
    const span = container.querySelector("span[aria-label]");
    expect(span).not.toBeNull();
    expect(span!.getAttribute("aria-label")).toBe("$482M");
  });

  it("defaults to no prefix or suffix", () => {
    const { container } = render(<AnimatedCounter value={17} />);
    const span = container.querySelector("span[aria-label]");
    expect(span!.getAttribute("aria-label")).toBe("17");
  });

  it("renders visible numeric text", () => {
    const { container } = render(<AnimatedCounter value={1240} suffix="+" />);
    const span = container.querySelector("span[aria-label]");
    expect(span!.textContent).toMatch(/\d/);
    expect(span!.textContent).toContain("+");
  });
});
