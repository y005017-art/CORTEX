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
      setError(err instanceof Error ? err.message : "登入流程發生問題。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="surface stack-gap">
      <div className="surface-header">
        <div>
          <p className="section-kicker">帳號</p>
          <h2>{mode === "login" ? "登入 CORTEX" : "建立 CORTEX 帳號"}</h2>
        </div>
        <span className="section-meta">角色工作台入口</span>
      </div>

      <form className="stack-gap" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label className="field">
            <span>顯示名稱</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
        ) : null}

        <label className="field">
          <span>電子郵件</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="field">
          <span>密碼</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? "處理中..." : mode === "login" ? "登入" : "建立帳號"}
        </button>
      </form>

      <button
        className="text-button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        type="button"
      >
        {mode === "login" ? "沒有帳號？改成註冊" : "已有帳號？回到登入"}
      </button>
    </section>
  );
}
