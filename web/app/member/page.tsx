import { SiteHeader } from "../components/site-header";
import { MemberCenter } from "./member-center";

export default function MemberPage() {
  return (
    <main className="member-page">
      <SiteHeader />

      <section className="member-hero">
        <div className="member-hero__inner">
          <p className="section__kicker">Membership</p>
          <h1>把用户、宠物、订单、社区和推荐串成长线留存</h1>
          <p>
            会员中心是商家运营的长期入口：用户每次回来都能看到宠物成长、订单记录、社区互动和下一步推荐。
          </p>
        </div>
      </section>

      <section className="member-section">
        <MemberCenter />
      </section>
    </main>
  );
}
