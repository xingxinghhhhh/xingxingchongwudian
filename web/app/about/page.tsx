import { Heart, Sparkles, Stars } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import {
  aboutChapters,
  accountName,
  accountTagline,
  socialBios,
  worldSummary
} from "../content-site-data";

const creatorNotes = [
  {
    title: "我们是谁",
    detail:
      "奶盖和年糕是主角，而“我”是和它们一起生活、一起被改变的人。这个网站和账号，记录的是三个人慢慢熟起来的过程。"
  },
  {
    title: "会记录什么",
    detail:
      "宠物档案、成长日记、相处里的小情绪、彼此靠近的过程，以及那些重复发生却越来越舍不得忘记的日常。"
  },
  {
    title: "为什么值得继续做",
    detail:
      "因为很多真正重要的陪伴，都是从这些并不轰烈的小瞬间里长出来的。记录它们，也是记录我自己被陪伴的方式。"
  }
];

const bioCards = [
  { platform: "抖音简介", text: socialBios.douyin },
  { platform: "小红书简介", text: socialBios.xiaohongshu },
  { platform: "微博简介", text: socialBios.weibo }
];

export default function AboutPage() {
  return (
    <main className="content-site">
      <SiteHeader />

      <section className="page-hero page-hero--about">
        <div className="page-hero__inner">
          <p className="eyebrow">{accountName}</p>
          <h1>关于奶盖和年糕，也是关于我为什么想把这些日常认真留下。</h1>
          <p className="page-hero__copy">{accountTagline}</p>
        </div>
      </section>

      <section className="section split-grid">
        <article className="detail-panel detail-panel--story">
          <p className="section__kicker">世界观</p>
          <h2 className="detail-panel__title">这个账号先是一个家里的故事，后来才慢慢长成一个项目。</h2>
          <p className="detail-panel__copy">{worldSummary}</p>
        </article>

        <article className="detail-panel detail-panel--story">
          <p className="section__kicker">账号构想</p>
          <div className="stack-list">
            {creatorNotes.map((note, index) => (
              <div className="stack-item" key={note.title}>
                <div>
                  <strong>{note.title}</strong>
                  <p>{note.detail}</p>
                </div>
                <span className="stack-item__meta">
                  {index === 0 ? <Heart size={14} /> : index === 1 ? <Sparkles size={14} /> : <Stars size={14} />}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="section">
        <div className="section__header">
          <p className="section__kicker">故事章节</p>
          <h2>网站里的“关于”，和社交平台上的一句简介，应该说的是同一个故事。</h2>
          <p className="section__copy">
            前台可以短一点，网站可以深一点，但语气、人物关系和世界观要始终一致。这样用户从抖音、小红书走进来，才会觉得这真的是同一个地方。
          </p>
        </div>

        <div className="chapter-grid">
          {aboutChapters.map((chapter, index) => (
            <article className="chapter-card" key={chapter.id}>
              <span className="chapter-card__index">0{index + 1}</span>
              <h3>{chapter.title}</h3>
              <p>{chapter.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <p className="section__kicker">主页简介</p>
          <h2>这是可以直接沿用到平台主页的统一简介口径。</h2>
          <p className="section__copy">
            抖音更利落，小红书更生活化，微博更像一句人设摘要，但核心都围绕奶盖、年糕和“陪伴慢慢发生”。
          </p>
        </div>

        <div className="chapter-grid">
          {bioCards.map((card, index) => (
            <article className="chapter-card" key={card.platform}>
              <span className="chapter-card__index">0{index + 1}</span>
              <h3>{card.platform}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
