import { SiteHeader } from "../../components/site-header";
import { AdminLoginForm } from "./admin-login-form";

export default function AdminLoginPage() {
  return (
    <main className="admin-page">
      <SiteHeader />

      <section className="admin-hero">
        <div className="admin-hero__inner">
          <p className="section__kicker">后台登录</p>
          <h1>员工登录</h1>
          <p>
            使用员工账号登录后，再管理商品、售后、客户和云养宠运营。

          </p>
        </div>
      </section>

      <section className="admin-section">
        <AdminLoginForm />
      </section>
    </main>
  );
}
