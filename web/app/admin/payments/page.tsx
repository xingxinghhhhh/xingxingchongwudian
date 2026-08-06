import { SiteHeader } from "../../components/site-header";
import { AdminAccessGate } from "../admin-access-gate";
import { PaymentsConsole } from "./payments-console";

export default function AdminPaymentsPage() {
  return (
    <main className="admin-page">
      <SiteHeader />

      <section className="admin-hero">
        <div className="admin-hero__inner">
          <p className="section__kicker">支付运营</p>
          <h1>支付流水</h1>
          <p>
            查看支付单、支付事件和订单支付状态，方便后台核对完整支付闭环。
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
