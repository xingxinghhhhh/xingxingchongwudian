import { SiteHeader } from "../components/site-header";
import { CloudPetStudio } from "./cloud-pet-studio";

export default function CloudPetsPage() {
  return (
    <main className="cloud-pets-page">
      <SiteHeader />

      <section className="cloud-pets-hero">
        <div className="cloud-pets-hero__inner">
          <p className="section__kicker">云养宠主线</p>
          <h1>把云养宠、主页、社区和商城做成一条活的链路</h1>
          <p>
            用户先定制一只宠物，再拥有专属主页、发布互动日常，最后自然进入宠物商城完成购买。
            这是给大型宠物电商商家看的可用闭环，不是摆设页。
          </p>
        </div>
      </section>

      <section className="cloud-pets-section">
        <CloudPetStudio />
      </section>
    </main>
  );
}
