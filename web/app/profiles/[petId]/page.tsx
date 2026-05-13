import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Heart } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { getJournalEntriesByPetId, getPetById, pets } from "../../content-site-data";

type PetDetailPageProps = {
  params: Promise<{
    petId: string;
  }>;
};

export function generateStaticParams() {
  return pets.map((pet) => ({ petId: pet.id }));
}

export default async function PetDetailPage({ params }: PetDetailPageProps) {
  const { petId } = await params;
  const pet = getPetById(petId);

  if (!pet) {
    notFound();
  }

  const diaryEntries = getJournalEntriesByPetId(pet.id);
  const counterpart = pets.find((item) => item.id !== pet.id);

  return (
    <main className="content-site">
      <SiteHeader />

      <section className="page-hero page-hero--detail">
        <div className="page-hero__inner">
          <Link className="back-link" href="/profiles">
            <ArrowLeft size={16} />
            返回全部档案
          </Link>
          <p className="eyebrow">{pet.type === "cat" ? "Cat profile" : "Dog profile"}</p>
          <h1>{pet.name} 的完整档案</h1>
          <p className="page-hero__copy">{pet.summary}</p>
        </div>
      </section>

      <section className="section detail-grid">
        <article className="detail-panel detail-panel--media">
          <div
            className="detail-panel__photo"
            style={{
              backgroundImage: `url(${pet.heroImage})`,
              backgroundPosition: pet.heroImagePosition
            }}
          />
        </article>

        <article className="detail-panel">
          <span className="chip">{pet.role}</span>
          <h2 className="detail-panel__title">它的相处方式，藏在很多很小的细节里。</h2>

          <dl className="profile-card__meta profile-card__meta--single">
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
        </article>
      </section>

      <section className="section split-grid">
        <article className="detail-panel">
          <p className="section__kicker">Relationship</p>
          <h2 className="detail-panel__title">
            {counterpart ? `${pet.name} 和 ${counterpart.name}` : `${pet.name} 的相处记录`}
          </h2>
          <p className="detail-panel__copy">
            {counterpart
              ? `${pet.name} 的很多情绪，都是在和 ${counterpart.name} 的互动里慢慢显出来的。一个不肯把依赖说出口，一个永远用行动表达喜欢，所以每一次靠近都很值得记录。`
              : "这只主角会在每一次重复出现的小动作里慢慢显出性格。"}
          </p>
        </article>

        <article className="detail-panel">
          <p className="section__kicker">Recent moments</p>
          <div className="stack-list">
            {diaryEntries.map((entry) => (
              <Link className="stack-item" href={`/diary/${entry.id}`} key={entry.id}>
                <div>
                  <strong>{entry.title}</strong>
                  <p>{entry.summary}</p>
                </div>
                <span className="stack-item__meta">
                  {entry.dateLabel}
                  <Heart size={14} />
                </span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="section">
        <Link className="text-link" href="/diary">
          去看全部成长日记
          <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
