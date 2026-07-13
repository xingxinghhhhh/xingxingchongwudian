import { SiteHeader } from "../../components/site-header";
import { AdminAccessGate } from "../admin-access-gate";
import { PaymentsConsole } from "./payments-console";

export default function AdminPaymentsPage() {
  return (
    <main className="admin-page">
      <SiteHeader />

      <section className="admin-hero">
        <div className="admin-hero__inner">
          <p className="section__kicker">Payments</p>
          <h1>Payment Intent Ledger</h1>
          <p>
            Review payment intents, inspect ledger events, and verify paid orders
            without leaving the admin console.
          </p>
        </div>
      </section>

      <section className="admin-section">
        <AdminAccessGate>
          <PaymentsConsole />
        </AdminAccessGate>
      </section>
    </main>
  );
}
