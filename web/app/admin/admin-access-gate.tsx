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
        <p className="section__kicker">Admin Session</p>
        <h2>Checking merchant console access</h2>
        <p>Validating the admin session before loading the protected console.</p>
      </section>
    );
  }

  return <>{children}</>;
}
