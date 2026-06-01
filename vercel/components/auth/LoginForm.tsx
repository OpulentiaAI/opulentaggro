"use client";

import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";

type LoginState = { error?: string };

async function loginWithState(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    const result = await loginAction(formData);
    return result ?? {};
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "Login failed" };
  }
}

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(loginWithState, {});
  const demoUser = process.env.NEXT_PUBLIC_DEMO_USER ?? "";

  return (
    <form action={formAction} className="login-form">
      <input type="hidden" name="redirect" value={redirectTo} />
      {state.error ? <div className="error-banner">{state.error}</div> : null}
      <label>
        Username
        <input
          type="text"
          name="usr"
          required
          autoComplete="username"
          placeholder={demoUser || "Administrator"}
          defaultValue={demoUser || undefined}
        />
      </label>
      <label>
        Password
        <input type="password" name="pwd" required autoComplete="current-password" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function LoginFooter() {
  return (
    <>
      <p className="muted" style={{ marginTop: "1.5rem", fontSize: "0.875rem" }}>
        Service mode: when <code>ERPNEXT_API_KEY</code> is configured, desk pages work without login.
        Set <code>ERPNEXT_REQUIRE_LOGIN=true</code> to enforce authentication.
      </p>
      <p style={{ marginTop: "1rem" }}>
        <Link href="/app">Continue without login →</Link>
      </p>
    </>
  );
}
