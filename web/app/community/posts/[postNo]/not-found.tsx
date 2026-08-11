import Link from "next/link";
import { SiteHeader } from "../../../components/site-header";

export default function CommunityPostNotFound() {
  return (
    <main className="cloud-pets-page">
      <SiteHeader />
      <section className="cloud-pets-section">
        <div className="cloud-empty" data-testid="community-post-not-found">
          <strong>这条社区动态暂时不可见</strong>
          <span>动态可能已被作者撤回或已通过商家审核隐藏。</span>
          <Link className="cloud-button" href="/cloud-pets#community">
            返回社区
          </Link>
        </div>
      </section>
    </main>
  );
}
