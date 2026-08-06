import Link from "next/link";
import { SiteHeader } from "../../components/site-header";

export default function CloudPetNotFound() {
  return (
    <main className="cloud-pets-page">
      <SiteHeader />
      <section className="cloud-pets-hero cloud-pets-hero--compact">
        <div className="cloud-pets-hero__inner">
          <p className="section__kicker">宠物主页</p>
          <h1>没有找到这只云养宠</h1>
          <p>分享链接可能已失效，或宠物编号填写有误。</p>
        </div>
      </section>
      <section className="cloud-pets-section">
        <div
          className="cloud-card cloud-empty"
          data-testid="pet-public-not-found"
          role="alert"
        >
          <strong>云养宠不存在</strong>
          <span>请检查分享链接，或回到工作台查看自己的云养宠。</span>
          <Link className="cloud-link-button" href="/cloud-pets">
            回到云养宠工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
