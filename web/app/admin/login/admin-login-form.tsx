"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, getAdminMe } from "../admin-api";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("owner123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getNextPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") ? next : "/admin/dashboard";
  }

  useEffect(() => {
    const sessionToken = localStorage.getItem("kzt_admin_session");

    if (!sessionToken) {
      return;
    }

    void getAdminMe(sessionToken)
      .then(() => {
        router.replace(getNextPath());
      })
      .catch(() => {
        localStorage.removeItem("kzt_admin_session");
      });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const login = await adminLogin({ email, password });
      localStorage.setItem("kzt_admin_session", login.sessionToken);
      router.replace(getNextPath());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Admin login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-card admin-card--token">
      <div>
        <p className="section__kicker">Admin Auth</p>
        <h2>Sign in to merchant operations</h2>
        <p>
          Use a staff session before managing catalog, refunds, customer CRM, and
          cloud-pet daily diary recovery.
        </p>
      </div>
      <form className="admin-token-form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <button className="admin-button" disabled={loading} type="submit">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className={error ? "admin-status admin-status--error" : "admin-status"}>
        {error ??
          "Seeded demo accounts: owner@example.com / owner123456, operator@example.com / operator123456."}
      </p>
    </section>
  );
}
