/**
 * Component tests for PasswordRulesChecklist.
 *
 * The checklist gives users live, per-rule feedback while they type a new
 * password. Each rule (minLength, mixedClasses, notCommon) must independently
 * flip from "not met" to "met" as the password value satisfies it, so users
 * can see exactly why a password "keeps getting rejected".
 *
 * We assert against the data-passed="true"|"false" attribute that the
 * component stamps on each <li data-testid="password-rule-<key>">, plus the
 * accessible (met)/(not met) text, rather than relying on color classes.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PasswordRulesChecklist from "../password-rules-checklist";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

type RuleKey = "minLength" | "mixedClasses" | "notCommon";

function renderChecklist(password: string) {
  return render(<PasswordRulesChecklist password={password} />);
}

function rulePassed(key: RuleKey): boolean {
  const li = screen.getByTestId(`password-rule-${key}`);
  return li.getAttribute("data-passed") === "true";
}

afterEach(() => {
  cleanup();
});

describe("PasswordRulesChecklist — rendering", () => {
  it("renders the list container and exactly the three known rules", () => {
    renderChecklist("");
    const list = screen.getByTestId("password-rules-checklist");
    expect(list).toBeTruthy();
    expect(screen.getByTestId("password-rule-minLength")).toBeTruthy();
    expect(screen.getByTestId("password-rule-mixedClasses")).toBeTruthy();
    expect(screen.getByTestId("password-rule-notCommon")).toBeTruthy();
  });

  it("applies the id prop to the list element (so inputs can aria-describedby it)", () => {
    render(<PasswordRulesChecklist password="" id="my-rules" />);
    expect(screen.getByTestId("password-rules-checklist").getAttribute("id")).toBe(
      "my-rules",
    );
  });
});

describe("PasswordRulesChecklist — empty password", () => {
  it("marks every rule as not met when the password is empty", () => {
    renderChecklist("");
    expect(rulePassed("minLength")).toBe(false);
    expect(rulePassed("mixedClasses")).toBe(false);
    expect(rulePassed("notCommon")).toBe(false);
  });
});

describe("PasswordRulesChecklist — minLength rule", () => {
  it(`is not met for a password shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    renderChecklist("a1!");
    expect(rulePassed("minLength")).toBe(false);
  });

  it(`turns met exactly at ${MIN_PASSWORD_LENGTH} characters`, () => {
    // Mixed classes so only minLength is under test here, but assert it directly.
    renderChecklist("ab12cd34"); // 8 chars
    expect(rulePassed("minLength")).toBe(true);
  });

  it(`is not met at ${MIN_PASSWORD_LENGTH - 1} characters and met at ${MIN_PASSWORD_LENGTH}`, () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    cleanup();
    renderChecklist(short);
    expect(rulePassed("minLength")).toBe(false);

    cleanup();
    renderChecklist("a".repeat(MIN_PASSWORD_LENGTH));
    expect(rulePassed("minLength")).toBe(true);
  });
});

describe("PasswordRulesChecklist — mixedClasses rule", () => {
  it("is not met for letters only", () => {
    renderChecklist("abcdefgh");
    expect(rulePassed("mixedClasses")).toBe(false);
  });

  it("is not met for digits only", () => {
    renderChecklist("24681357");
    expect(rulePassed("mixedClasses")).toBe(false);
  });

  it("is met for letters + digits", () => {
    renderChecklist("abcd1234");
    expect(rulePassed("mixedClasses")).toBe(true);
  });

  it("is met for letters + symbols", () => {
    renderChecklist("abcd!!!!");
    expect(rulePassed("mixedClasses")).toBe(true);
  });

  it("is met for digits + symbols", () => {
    renderChecklist("2468!!!!");
    expect(rulePassed("mixedClasses")).toBe(true);
  });
});

describe("PasswordRulesChecklist — notCommon rule", () => {
  it("is not met for a known common password (case-insensitive)", () => {
    renderChecklist("PASSWORD");
    expect(rulePassed("notCommon")).toBe(false);
  });

  it("is not met for the empty string (nothing entered yet)", () => {
    renderChecklist("");
    expect(rulePassed("notCommon")).toBe(false);
  });

  it("is met for a non-listed password", () => {
    renderChecklist("Zq7-mountain");
    expect(rulePassed("notCommon")).toBe(true);
  });
});

describe("PasswordRulesChecklist — a fully-valid password", () => {
  it("marks all three rules as met", () => {
    renderChecklist("Str0ng-Pass!");
    expect(rulePassed("minLength")).toBe(true);
    expect(rulePassed("mixedClasses")).toBe(true);
    expect(rulePassed("notCommon")).toBe(true);
  });

  it("exposes screen-reader (met) text for satisfied rules", () => {
    renderChecklist("Str0ng-Pass!");
    const li = screen.getByTestId("password-rule-minLength");
    expect(li.textContent ?? "").toMatch(/\(met\)/);
  });

  it("exposes screen-reader (not met) text for unsatisfied rules", () => {
    renderChecklist("abcdefgh"); // letters only, long enough -> mixedClasses not met
    const li = screen.getByTestId("password-rule-mixedClasses");
    expect(li.textContent ?? "").toMatch(/\(not met\)/);
  });
});
