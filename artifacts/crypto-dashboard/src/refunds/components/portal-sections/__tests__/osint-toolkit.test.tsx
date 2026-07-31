/**
 * OSINT toolkit portal section — live address/tx inspection UI.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import OsintToolkit from "../osint-toolkit";

afterEach(() => cleanup());

describe("OSINT toolkit portal section", () => {
  it("inspects a valid EVM address and surfaces explorer links", () => {
    render(<OsintToolkit />);
    fireEvent.change(screen.getByTestId("osint-address-input"), {
      target: { value: "0x52908400098527886E0F7030069857D2E4169EE7" },
    });
    const result = screen.getByTestId("osint-address-result");
    expect(result.textContent).toContain("Ethereum / EVM");
    expect(result.textContent).toContain("Etherscan");
  });

  it("flags an unrecognized address", () => {
    render(<OsintToolkit />);
    fireEvent.change(screen.getByTestId("osint-address-input"), {
      target: { value: "definitely-not-valid" },
    });
    const result = screen.getByTestId("osint-address-result");
    expect(result.textContent).toContain("Not a recognized");
  });

  it("inspects a transaction hash", () => {
    render(<OsintToolkit />);
    fireEvent.change(screen.getByTestId("osint-tx-input"), {
      target: { value: "0x" + "a".repeat(64) },
    });
    expect(screen.getByTestId("osint-tx-result").textContent).toContain("Ethereum / EVM");
  });
});
