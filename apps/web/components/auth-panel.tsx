"use client";

import { FormEvent, useState } from "react";

import { login, register } from "@/lib/api";
import { AuthUser, storeSession } from "@/lib/auth";


type AuthPanelProps = {
  onAuthenticated: (user: AuthUser) => void;
};

export function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("TIM");
  const [email, setEmail] = useState("tim+codex-cortex@example.com");
  const [password, setPassword] = useState("CortexPass123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const session =
        mode === "register"
          ? await register({ email, display_name: displayName, password })
          : await login({ email, password });
      storeSession(session.token, session.user);
      onAuthenticated(session.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel stack-gap">
      <div className="panel-header">
        <h2>{mode === "login" ? "Sign In" : "Register"}</h2>
        <span>Local auth</span>
      </div>

      <form className="stack-gap" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
        ) : null}

        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting
            ? "Working..."
            : mode === "login"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>

      <button
        className="text-button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        type="button"
      >
        {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
      </button>
    </section>
  );
}
