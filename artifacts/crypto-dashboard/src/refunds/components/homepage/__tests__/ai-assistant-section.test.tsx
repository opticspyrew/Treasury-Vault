import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import AiAssistantSection from "../ai-assistant-section";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("AiAssistantSection", () => {
  it("renders the full illustrative conversation thread", () => {
    const { container } = render(<AiAssistantSection />);
    const text = container.textContent ?? "";
    expect(text).toContain(
      "What's the current status of my ETH recovery case?",
    );
    expect(text).toContain("Case RF-2026-0184 is in active investigation.");
    expect(text).toContain("What should I do next?");
    expect(text).toContain("Your analyst has drafted an authorization request");
  });

  it("lists the assistant's capabilities", () => {
    const { container } = render(<AiAssistantSection />);
    const caps = container.querySelectorAll("ul li");
    expect(caps.length).toBe(3);
    const text = container.textContent ?? "";
    expect(text).toContain("Summarizes case status in plain language");
    expect(text).toContain("Cites the on-chain evidence behind each answer");
  });
});
