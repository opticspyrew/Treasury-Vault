import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import SecureVault from "../secure-vault";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("SecureVault", () => {
  it("lists every vault feature", () => {
    const { container } = render(<SecureVault />);
    const features = container.querySelectorAll("ul li");
    expect(features.length).toBe(4);
    const text = container.textContent ?? "";
    expect(text).toContain(
      "Per-case encrypted file with scoped analyst access",
    );
    expect(text).toContain(
      "Read-only on-chain analysis until you authorize action",
    );
  });

  it("shows the illustrative vault balance breakdown", () => {
    const { container } = render(<SecureVault />);
    const text = container.textContent ?? "";
    for (const label of ["Recovered", "At-risk", "Monitored", "Risk score"]) {
      expect(text).toContain(label);
    }
  });

  it("offers a call to action to open a vault", () => {
    const { getByText } = render(<SecureVault />);
    expect(getByText(/Open your vault/i)).not.toBeNull();
  });
});
