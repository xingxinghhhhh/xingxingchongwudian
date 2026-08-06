"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAdminMe } from "./admin-api";

interface AdminAccessGateProps {
  children: ReactNode;
}

export function AdminAccessGate({ children }: AdminAccessGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sessionToken = localStorage.getItem("kzt_admin_session");
    const next = pathname + window.location.search;

    if (!sessionToken) {
      router.replace(`/admin/login?next=${encodeURIComponent(next)}`);
      return;
    }

    void getAdminMe(sessionToken)
      .then(() => {
        setReady(true);
      })
      .catch(() => {
        localStorage.removeItem("kzt_admin_session");
        router.replace(`/admin/login?next=${encodeURIComponent(next)}`);
      });
  }, [pathname, router]);

  if (!ready) {
    return (
      <section className="admin-card">
        <p className="section__kicker">后台会话</p>
        <h2>正在验证商家后台访问权限</h2>
        <p>验证完成后将自动进入后台，请稍候。</p>
      </section>
    );
  }

  return <>{children}</>;
}
