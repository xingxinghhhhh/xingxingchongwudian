import { SiteHeader } from "../../components/site-header";
import { AdminLoginForm } from "./admin-login-form";

export default function AdminLoginPage() {
  return (
    <main className="admin-page">
      <SiteHeader />

      <section className="admin-hero">
        <div className="admin-hero__inner">
          <p className="section__kicker">Admin Auth</p>
          <h1>Merchant Console Sign-In</h1>
          <p>
            Sign in with a staff session before managing catalog, after-sales,
            CRM, and cloud-pet operations.
          </p>
        </div>
      </section>

      <section className="admin-section">
        <AdminLoginForm />
      </section>
    </main>
  );
}
