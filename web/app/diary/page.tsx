import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import {
  DiaryArchiveFilter,
  getDiaryArchiveEntries,
  getPetById
} from "../content-site-data";

type DiaryPageProps = {
  searchParams?: Promise<{
    pet?: string;
  }>;
};

const filterItems: Array<{
  key: DiaryArchiveFilter;
  label: string;
  href: string;
}> = [
  { key: "all", label: "全部", href: "/diary" },
  { key: "naigai", label: "奶盖", href: "/diary?pet=naigai" },
  { key: "niangao", label: "年糕", href: "/diary?pet=niangao" }
];

export default async function DiaryPage({ searchParams }: DiaryPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedFilter = resolvedSearchParams?.pet;

  const activeFilter: DiaryArchiveFilter =
    requestedFilter === "naigai" || requestedFilter === "niangao"
      ? requestedFilter
      : "all";

  const entries = getDiaryArchiveEntries(activeFilter);

  return (
    <main className="content-site">
      <SiteHeader />

      <section className="page-hero">
        <div className="page-hero__inner">
          <p className="eyebrow">日记归档</p>
          <h1>这里收着奶盖和年糕慢慢长大的时间线。</h1>
          <p className="page-hero__copy">
            每一篇日记都不算惊天动地，但连在一起，就会慢慢看见陪伴是怎么发生的。你可以一起看，也可以只跟着奶盖或年糕往下翻。
          </p>
        </div>
      </section>

      <section className="section archive-shell">
        <div className="archive-filter" role="tablist" aria-label="日记筛选">
          {filterItems.map((item) => (
            <Link
              className={
                item.key === activeFilter
                  ? "archive-filter__item archive-filter__item--active"
                  : "archive-filter__item"
              }
              href={item.href}
              key={item.key}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {entries.length === 0 ? (
          <div className="detail-panel">
            <p className="detail-panel__copy">
              这一栏还没有新的记录，但奶盖和年糕很快会继续长出新的日常。
            </p>
          </div>
        ) : (
          <div className="timeline">
            {entries.map((entry) => {
              const pet = getPetById(entry.petId);

              return (
                <article className="timeline-entry" key={entry.id}>
                  <div className="timeline-entry__rail">
                    <span className="timeline-entry__dot" />
                    <span className="timeline-entry__date">{entry.dateLabel}</span>
                  </div>

                  <div className="timeline-entry__card">
                    <div className="timeline-entry__meta">
                      <span className="chip chip--soft">{pet?.name ?? "记录"}</span>
                      <span className="mood-pill">{entry.mood}</span>
                    </div>

                    <h2>{entry.title}</h2>
                    <p>{entry.summary}</p>

                    <div className="tag-row tag-row--profile">
                      {entry.tags.map((tag) => (
                        <span className="tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <Link className="text-link text-link--spaced" href={`/diary/${entry.id}`}>
                      读完整记录
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
