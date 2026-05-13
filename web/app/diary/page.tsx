import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import { getLatestJournalEntries, journalEntries, pets } from "../content-site-data";

const allEntries = getLatestJournalEntries(journalEntries, journalEntries.length);

export default function DiaryPage() {
  return (
    <main className="content-site">
      <SiteHeader />

      <section className="page-hero">
        <div className="page-hero__inner">
          <p className="eyebrow">Diary archive</p>
          <h1>这里收着奶盖和年糕每天长出来的一点点变化。</h1>
          <p className="page-hero__copy">
            有些是靠近，有些是吃醋，有些只是今天愿意多待一会儿。日记不需要每篇都轰轰烈烈，但要让人想继续翻下去。
          </p>
        </div>
      </section>

      <section className="section">
        <div className="diary-grid">
          {allEntries.map((entry) => {
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
                  读完整记录
                  <ArrowRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
