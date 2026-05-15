import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Heart } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import {
  getAdjacentJournalEntries,
  getJournalEntryById,
  getJournalEntriesByPetId,
  getPetById,
  journalEntries
} from "../../content-site-data";

type DiaryEntryPageProps = {
  params: Promise<{
    entryId: string;
  }>;
};

export function generateStaticParams() {
  return journalEntries.map((entry) => ({ entryId: entry.id }));
}

export default async function DiaryEntryPage({ params }: DiaryEntryPageProps) {
  const { entryId } = await params;
  const entry = getJournalEntryById(entryId);

  if (!entry) {
    notFound();
  }

  const pet = getPetById(entry.petId);
  const { previous, next } = getAdjacentJournalEntries(entry.id);
  const relatedEntries = getJournalEntriesByPetId(entry.petId).filter(
    (item) => item.id !== entry.id
  );

  return (
    <main className="content-site">
      <SiteHeader />

      <section className="article-hero">
        <div className="article-hero__inner">
          <Link className="back-link" href="/diary">
            <ArrowLeft size={16} />
            返回日记列表
          </Link>
          <p className="eyebrow">{pet ? `${pet.name} · ${entry.dateLabel}` : entry.dateLabel}</p>
          <h1>{entry.title}</h1>
          <p className="article-hero__subtitle">{entry.subtitle}</p>
        </div>
      </section>

      <section className="section article-layout">
        <article className="article-body">
          <div className="article-body__meta">
            <span className="chip chip--soft">{entry.dateLabel}</span>
            <span className="mood-pill">{entry.mood}</span>
          </div>

          <p className="article-body__intro">{entry.intro}</p>

          {entry.sections.map((section) => (
            <section className="article-section" key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}

          <p className="article-body__closing">{entry.closingNote}</p>

          {pet ? (
            <Link className="text-link text-link--spaced" href={`/profiles/${pet.id}`}>
              去看 {pet.name} 的完整档案
              <ArrowRight size={16} />
            </Link>
          ) : null}
        </article>

        <aside className="article-aside">
          <div className="detail-panel">
            <p className="section__kicker">这篇记录的情绪</p>
            <div className="tag-row tag-row--profile">
              <span className="mood-pill">{entry.mood}</span>
              {entry.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="detail-panel">
            <p className="section__kicker">同主角继续阅读</p>
            <div className="stack-list">
              {relatedEntries.map((relatedEntry) => (
                <Link className="stack-item" href={`/diary/${relatedEntry.id}`} key={relatedEntry.id}>
                  <div>
                    <strong>{relatedEntry.title}</strong>
                    <p>{relatedEntry.summary}</p>
                  </div>
                  <span className="stack-item__meta">
                    {relatedEntry.dateLabel}
                    <Heart size={14} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="section article-pagination">
        {previous ? (
          <Link className="detail-panel article-pagination__item" href={`/diary/${previous.id}`}>
            <span className="section__kicker">上一篇</span>
            <strong>{previous.title}</strong>
          </Link>
        ) : (
          <span />
        )}

        {next ? (
          <Link className="detail-panel article-pagination__item article-pagination__item--next" href={`/diary/${next.id}`}>
            <span className="section__kicker">下一篇</span>
            <strong>{next.title}</strong>
          </Link>
        ) : (
          <span />
        )}
      </section>
    </main>
  );
}
