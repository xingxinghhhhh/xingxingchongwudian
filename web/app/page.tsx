import Link from "next/link";
import { ArrowRight, BookOpen, Heart, Sparkles, Stars, SunMedium } from "lucide-react";
import { CmsSlot } from "./cms-slot";
import { SiteHeader } from "./components/site-header";
import {
  accountName,
  favoriteMoments,
  getLatestJournalEntries,
  journalEntries,
  pets,
  storyChapters,
  worldSummary
} from "./content-site-data";

const latestEntries = getLatestJournalEntries(journalEntries, 4);

const futurePlans = [
  {
    title: "定制云养宠",
    detail:
      "以后每位用户都可以拥有一只自己的宠物角色，拥有专属档案、成长记录、情绪日记和固定更新节奏。"
  },
  {
    title: "宠物专属主页",
    detail:
      "把名字、性格、习惯、最爱和重要时刻整理成一页真正属于这只宠物的数字家书。"
  },
  {
    title: "宠物互动社区",
    detail:
      "让不同用户的宠物互相认识、串门、留言、晒日常，也为后面的玩具和衣服内容留出自然入口。"
  }
];

const siteNotes = [
  "一只是傲娇小猫，一只是社牛小狗，从陌生到熟悉，一起长大。",
  "这里先记录奶盖和年糕，也为以后更多人的云养宠生活留出位置。"
];

export default function Home() {
  return (
    <main className="content-site">
      <SiteHeader />

      <section className="hero" id="top">
        <div className="hero__backdrop" />
        <div className="hero__inner">
          <p className="eyebrow">{accountName}</p>
          <h1>一只嘴硬的小猫，和一只永远开心的小狗，把陪伴过成每天都想追更的连续剧。</h1>
          <p className="hero__copy">{worldSummary}</p>

          <div className="hero__actions">
            <Link className="button button--primary" href="/diary">
              看最新日记
              <ArrowRight size={16} />
            </Link>
            <Link className="button button--ghost" href="/profiles">
              认识奶盖和年糕
            </Link>
          </div>

          <div className="hero__notes" aria-label="云养宠运营记录">
            {siteNotes.map((note) => (
              <div className="hero__note" key={note}>
                <Sparkles size={16} />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--profiles" id="profiles">
        <div className="section__header">
          <p className="section__kicker">核心闭环</p>
          <h2>先认识它们，再开始追更它们的小情绪。</h2>
          <p className="section__copy">
            奶盖负责把“表面嫌弃、实际依赖”演得很满，年糕负责把“主动靠近、永远开心”做得很真。
            两种完全不同的性格，刚好让这个家每天都有新的互动。
          </p>
        </div>

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
                  看 {pet.name} 的完整档案
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="stories">
        <div className="section__header section__header--tight">
          <div>
            <p className="section__kicker">留存体验</p>
            <h2>这一阶段，我们先把它们从“同住”写到“同频”。</h2>
          </div>
          <p className="section__copy">
            网站会先围绕“陌生期、磨合期、依赖感”来展开。这样后面无论是定制云养宠，还是别的用户带着自己的宠物进来，
            这个结构都能自然长下去。
          </p>
        </div>

        <div className="chapter-grid">
          {storyChapters.map((chapter, index) => (
            <article className="chapter-card" key={chapter.id}>
              <span className="chapter-card__index">0{index + 1}</span>
              <h3>{chapter.title}</h3>
              <p>{chapter.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--diary" id="diary">
        <div className="section__header section__header--tight">
          <div>
            <p className="section__kicker">商城转化</p>
            <h2>每天一点点变化，就足够让人想继续看下去。</h2>
          </div>
          <Link className="text-link" href="/diary">
            看全部日记
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="diary-grid">
          {latestEntries.map((entry) => {
            const pet = pets.find((item) => item.id === entry.petId);

            return (
              <article className="diary-card" key={entry.id}>
                <div className="diary-card__topline">
                  <span className="chip chip--soft">{entry.dateLabel}</span>
                  <span className="diary-card__pet">
                    {pet?.name}
                    <Heart size={14} />
                  </span>
                </div>

                <h3>{entry.title}</h3>
                <p>{entry.summary}</p>

                <div className="diary-card__footer">
                  <span className="mood-pill">{entry.mood}</span>
                  <div className="tag-row">
                    {entry.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <Link className="text-link text-link--spaced" href={`/diary/${entry.id}`}>
                  继续读这篇日记
                  <ArrowRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <CmsSlot slotPrefix="homepage" />

      <section className="section section--favorites">
        <div className="section__header">
          <p className="section__kicker">运营后台</p>
          <h2>它们最动人的，不一定是大事件，而是那些会重复发生的小习惯。</h2>
          <p className="section__copy">
            后面这里可以自然接到“最爱的玩具”和“同款东西”，但现在先让喜欢本身成为内容，让人先爱上这两个角色。
          </p>
        </div>

        <div className="moment-grid">
          {favoriteMoments.map((moment, index) => (
            <article className="moment-card" key={moment.id}>
              <div className="moment-card__icon">
                {index === 0 ? (
                  <SunMedium size={20} />
                ) : index === 1 ? (
                  <Stars size={20} />
                ) : (
                  <BookOpen size={20} />
                )}
              </div>
              <h3>{moment.label}</h3>
              <p>{moment.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--future" id="future">
        <div className="section__header">
          <p className="section__kicker">上线节奏</p>
          <h2>等奶盖和年糕的世界站稳了，我们再把“云养宠”真正做成产品。</h2>
          <p className="section__copy">
            这一步不会急着上很重的功能。我们会先保留清晰的升级路径，让内容、会员、社区和以后的小商店都是顺着这个世界观长出来的。
          </p>
        </div>

        <div className="roadmap-grid">
          {futurePlans.map((plan) => (
            <article className="roadmap-card" key={plan.title}>
              <span className="roadmap-card__badge">进行中</span>
              <h3>{plan.title}</h3>
              <p>{plan.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
