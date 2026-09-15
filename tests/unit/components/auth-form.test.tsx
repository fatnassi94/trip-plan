// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword, isAuthConfigured } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  isAuthConfigured: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  isAuthConfigured,
  createClient: () => ({ auth: { signInWithPassword } }),
}));

import { AuthForm } from "@/components/auth/auth-form";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function fillAndSubmit(button: "Create account" | "Log in") {
  const user = userEvent.setup();
  if (button === "Log in") await user.click(screen.getByRole("tab", { name: "Log in" }));
  await user.type(screen.getByLabelText("Email"), "traveler@example.com");
  await user.type(screen.getByLabelText(/^Password/), "12345678");
  await user.click(screen.getByRole("button", { name: button }));
}

beforeEach(() => {
  isAuthConfigured.mockReturnValue(true);
  signInWithPassword.mockResolvedValue({ error: null });
});

describe("AuthForm", () => {
  it("signs up: creates the account server-side, signs in, then reports success", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const onAuthenticated = vi.fn();
    render(<AuthForm onAuthenticated={onAuthenticated} />);

    await fillAndSubmit("Create account");

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "traveler@example.com", password: "12345678" }),
      }),
    );
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "traveler@example.com", password: "12345678" });
  });

  it("switches to Log in when the email already has an account", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(409, { error: "An account with this email already exists — log in instead." })));
    const onAuthenticated = vi.fn();
    render(<AuthForm onAuthenticated={onAuthenticated} />);

    await fillAndSubmit("Create account");

    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(screen.getByRole("tab", { name: "Log in" })).toHaveAttribute("aria-selected", "true");
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("logs in without calling the signup endpoint, and shows a wrong-password error", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });
    const onAuthenticated = vi.fn();
    render(<AuthForm onAuthenticated={onAuthenticated} />);

    await fillAndSubmit("Log in");

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("explains when sign-in isn't configured instead of showing a broken form", () => {
    isAuthConfigured.mockReturnValue(false);
    render(<AuthForm onAuthenticated={() => {}} />);
    expect(screen.getByText(/isn.t configured for this deployment/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
  });
});
