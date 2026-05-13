import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Heart } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import {
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
  const relatedEntries = getJournalEntriesByPetId(entry.petId).filter(
    (item) => item.id !== entry.id
  );

  return (
    <main className="content-site">
      <SiteHeader />

      <section className="page-hero page-hero--detail">
        <div className="page-hero__inner">
          <Link className="back-link" href="/diary">
            <ArrowLeft size={16} />
            返回日记列表
          </Link>
          <p className="eyebrow">Diary entry</p>
          <h1>{entry.title}</h1>
          <p className="page-hero__copy">
            {pet ? `${pet.name} · ${entry.dateLabel} · ${entry.mood}` : `${entry.dateLabel} · ${entry.mood}`}
          </p>
        </div>
      </section>

      <section className="section split-grid">
        <article className="detail-panel detail-panel--story">
          <span className="chip chip--soft">{entry.dateLabel}</span>
          <h2 className="detail-panel__title">{pet ? `${pet.name} 的这一天` : "今天的记录"}</h2>
          <p className="detail-panel__copy">{entry.summary}</p>

          <div className="tag-row tag-row--profile">
            <span className="mood-pill">{entry.mood}</span>
            {entry.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </article>

        <article className="detail-panel">
          <p className="section__kicker">Related reading</p>
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
        </article>
      </section>

      {pet ? (
        <section className="section">
          <Link className="text-link" href={`/profiles/${pet.id}`}>
            去看 {pet.name} 的完整档案
            <ArrowRight size={16} />
          </Link>
        </section>
      ) : null}
    </main>
  );
}
