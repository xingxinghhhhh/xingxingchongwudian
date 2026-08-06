"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, getAdminMe } from "../admin-api";

const SHOW_DEVELOPMENT_ACCOUNTS = process.env.NODE_ENV === "development";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(
    SHOW_DEVELOPMENT_ACCOUNTS ? "owner@example.com" : ""
  );
  const [password, setPassword] = useState(
    SHOW_DEVELOPMENT_ACCOUNTS ? "owner123456" : ""
  );
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
      setError(caught instanceof Error ? caught.message : "后台登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-card admin-card--token">
      <div>
        <p className="section__kicker">后台登录</p>
        <h2>员工账号登录</h2>
        <p>
          登录后可管理商品、退款、客户和云养宠日记补救。

        </p>
      </div>
      <form className="admin-token-form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          邮箱
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          密码
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <button className="admin-button" disabled={loading} type="submit">
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
      {error || SHOW_DEVELOPMENT_ACCOUNTS ? (
        <p
          className={error ? "admin-status admin-status--error" : "admin-status"}
        >
          {error ??
            "测试账号：owner@example.com / owner123456，operator@example.com / operator123456。"}
        </p>
      ) : null}
    </section>
  );
}
