/**
 * AI assistant portal section.
 *
 * Verifies the chat streams an assistant reply from the SSE endpoint, replays
 * conversation history to the backend, switches between recovery/forensics
 * modes, and surfaces a clean error when the request fails. The auth context
 * is mocked to supply a token and `fetch` is mocked to emit a fake SSE stream
 * so the section runs without a backend.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ token: "test-token", user: { name: "Tester", email: "t@example.com" } }),
}));

import AiAssistant from "../ai-assistant";

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView, which the section calls on update.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

function sseResponse(events: Array<Record<string, unknown>>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
  return { ok: true, body: stream } as unknown as Response;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AI assistant portal section", () => {
  it("streams an assistant reply and replays history to the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([{ content: "Tracing " }, { content: "the funds." }, { done: true }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant />);

    fireEvent.change(screen.getByLabelText("Ask the assistant"), {
      target: { value: "What happens next?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Tracing the funds.")).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/public/refunds/ai/chat");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.mode).toBe("recovery");
    // History replays the welcome message plus the user's new turn.
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "What happens next?" });
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
  });

  it("switches to forensics mode and sends that mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([{ content: "ok" }, { done: true }]));
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant />);

    fireEvent.click(screen.getByRole("button", { name: /forensics/i }));
    fireEvent.change(screen.getByLabelText("Ask the assistant"), {
      target: { value: "Trace this address" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.mode).toBe("forensics");
  });

  it("surfaces a clean error when the request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Too Many Requests",
      json: async () => ({ error: "Too many requests, please slow down." }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant />);

    fireEvent.change(screen.getByLabelText("Ask the assistant"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Too many requests, please slow down.")).toBeTruthy();
  });
});
