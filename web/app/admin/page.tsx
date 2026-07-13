import { SiteHeader } from "../components/site-header";
import { AdminAccessGate } from "./admin-access-gate";
import { AdminConsole } from "./admin-console";

export default function AdminPage() {
  return (
    <main className="admin-page">
      <SiteHeader />

      <section className="admin-hero">
        <div className="admin-hero__inner">
          <p className="section__kicker">Operations</p>
          <h1>商家后台，把云养宠、社区和商城运营管起来</h1>
          <p>
            给大型电商商家交付时，前台体验只是第一步。后台必须能看运营指标、查云养宠档案、处理社区内容。
          </p>
        </div>
      </section>

      <section className="admin-section">
        <AdminAccessGate>
          <AdminConsole />
        </AdminAccessGate>
      </section>
    </main>
  );
}
