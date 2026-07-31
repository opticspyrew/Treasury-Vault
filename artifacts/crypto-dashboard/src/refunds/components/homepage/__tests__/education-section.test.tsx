import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import EducationSection from "../education-section";
import { getBlogArticles } from "../../../data/mocks";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("EducationSection", () => {
  it("renders one card per blog article", () => {
    const { container } = render(<EducationSection />);
    const cards = container.querySelectorAll("article");
    expect(cards.length).toBe(getBlogArticles().length);
  });

  it("shows each article's category, title, excerpt, and read time", () => {
    const { container } = render(<EducationSection />);
    const text = container.textContent ?? "";
    for (const article of getBlogArticles()) {
      expect(text).toContain(article.category);
      expect(text).toContain(article.title);
      expect(text).toContain(article.excerpt);
      expect(text).toContain(`${article.readMinutes} min`);
    }
  });
});
