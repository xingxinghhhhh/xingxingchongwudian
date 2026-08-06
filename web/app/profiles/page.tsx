import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import { pets } from "../content-site-data";

export default function ProfilesPage() {
  return (
    <main className="content-site">
      <SiteHeader />

      <section className="page-hero">
        <div className="page-hero__inner">
          <p className="eyebrow">宠物档案</p>
          <h1>奶盖和年糕的档案，不只是介绍，更是理解它们的入口。</h1>
          <p className="page-hero__copy">
            一个会偷偷在意，一个永远主动靠近。先把它们各自的脾气、偏好和依赖方式看清楚，后面的每篇日记才会更好看。
          </p>
        </div>
      </section>

      <section className="section section--profiles">
        <div className="profile-grid">
          {pets.map((pet) => (
            <article className="profile-card" key={pet.id}>
              <div
                className="profile-card__media"
                style={{
                  backgroundImage: `url(${pet.heroImage})`,
                  backgroundPosition: pet.heroImagePosition
                }}
              />
              <div className="profile-card__content">
                <div className="profile-card__intro">
                  <span className="chip">{pet.type === "cat" ? "主角小猫" : "主角小狗"}</span>
                  <h3>{pet.name}</h3>
                  <p>{pet.role}</p>
                </div>

                <dl className="profile-card__meta">
                  <div>
                    <dt>年龄</dt>
                    <dd>{pet.ageLabel}</dd>
                  </div>
                  <div>
                    <dt>外形</dt>
                    <dd>{pet.breedLabel}</dd>
                  </div>
                  <div>
                    <dt>性格</dt>
                    <dd>{pet.temperament}</dd>
                  </div>
                  <div>
                    <dt>最爱</dt>
                    <dd>{pet.favoriteThing}</dd>
                  </div>
                </dl>

                <div className="tag-row tag-row--profile">
                  {pet.keywords.map((keyword) => (
                    <span className="tag" key={keyword}>
                      {keyword}
                    </span>
                  ))}
                </div>

                <p className="profile-card__summary">{pet.summary}</p>
                <Link className="text-link text-link--spaced" href={`/profiles/${pet.id}`}>
                  进入 {pet.name} 的档案页
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
