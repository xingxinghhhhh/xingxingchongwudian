import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import type {
  CloudPetHomepageArchive,
  CloudPetPublicProfile,
  CloudPetRecommendation,
  CommunityComment,
  CommunityPost
} from "../cloud-pets-api";
import {
  getCloudPet,
  getCloudPetHomepageArchive,
  getCloudPetRecommendations,
  listCommunityComments,
  listCommunityPosts
} from "../cloud-pets-api";
import { getProductTitleLabel } from "../../shop/shop-copy";
import { HomepageVisitTracker } from "./homepage-visit-tracker";
import { PublicPetViewer } from "./public-pet-viewer";

interface PetHomepageProps {
  params: Promise<{
    petNo: string;
  }>;
  searchParams?: Promise<{
    archive?: string;
  }>;
}

type ArchiveFilter = "all" | "growth_task" | "daily_diary" | "owner_note";

const archiveFilters = new Set<ArchiveFilter>([
  "all",
  "growth_task",
  "daily_diary",
  "owner_note"
]);

function getCareStateLabel(state: CloudPetPublicProfile["growth"]["careState"]) {
  const labels: Record<CloudPetPublicProfile["growth"]["careState"], string> = {
    needs_care: "需要陪伴",
    steady: "状态稳定",
    thriving: "元气满满"
  };

  return labels[state];
}

function getDiaryShareAnchor(event: { id?: string; createdAt: string }) {
  return "diary-" + (event.id ?? event.createdAt).replace(/[^a-zA-Z0-9_-]/g, "-");
}

export default async function PetHomepage({ params, searchParams }: PetHomepageProps) {
  const { petNo } = await params;
  const requestedArchive = (await searchParams)?.archive;
  const archive = normalizeArchiveFilter(requestedArchive);
  let pet: CloudPetPublicProfile | null = null;
  let homepageArchive: CloudPetHomepageArchive | null = null;
  let recommendations: CloudPetRecommendation[] = [];
  let communityPosts: CommunityPost[] = [];
  let communityCommentsByPost: Record<string, CommunityComment[]> = {};
  let loadError: string | null = null;
  const partialLoadSections: string[] = [];

  try {
    pet = await getCloudPet(petNo);
  } catch (caught) {
    if (
      caught instanceof Error &&
      caught.message === "Cloud pet not found"
    ) {
      notFound();
    }
    loadError = "服务暂时不可用，请稍后重新打开宠物主页。";
  }

  if (pet) {
    const [archiveResult, recommendationResult, communityResult] =
      await Promise.allSettled([
        getCloudPetHomepageArchive(petNo, {
          eventType: archive === "all" ? undefined : archive
        }),
        getCloudPetRecommendations(petNo),
        listCommunityPosts()
      ]);

    if (archiveResult.status === "fulfilled") {
      homepageArchive = archiveResult.value;
    } else {
      partialLoadSections.push("成长归档");
    }

    if (recommendationResult.status === "fulfilled") {
      recommendations = recommendationResult.value;
    } else {
      partialLoadSections.push("档案推荐");
    }

    if (communityResult.status === "fulfilled") {
      communityPosts = communityResult.value
        .filter((post) => post.petNo === petNo)
        .slice(0, 3);
      const commentResults = await Promise.allSettled(
        communityPosts.map((post) => listCommunityComments(post.postNo))
      );
      communityCommentsByPost = Object.fromEntries(
        commentResults.flatMap((result, index) =>
          result.status === "fulfilled"
            ? [[communityPosts[index].postNo, result.value.slice(0, 2)]]
            : []
        )
      );
      if (commentResults.some((result) => result.status === "rejected")) {
        partialLoadSections.push("社区评论");
      }
    } else {
      partialLoadSections.push("社区动态");
    }
  }

  const archiveItems = homepageArchive?.items ?? pet?.timeline ?? [];
  const todayDateKey = new Date().toISOString().slice(0, 10);
  const todayDailyDiary =
    pet?.timeline.find(
      (event) => event.type === "daily_diary" && event.createdAt.startsWith(todayDateKey)
    ) ?? null;
  const recentDiaryEntries = archiveItems
    .filter((event) => event.type === "daily_diary" || event.type === "owner_note")
    .slice(0, 2);
  const communityEngagementTotal = communityPosts.reduce(
    (total, post) => total + post.likeCount + post.commentCount,
    0
  );
  const latestCommunityPost = communityPosts[0] ?? null;
  const publicDiaryDays = Array.from(
    archiveItems
      .filter((event) => event.type === "daily_diary" || event.type === "owner_note")
      .reduce(
        (days, event) => {
          const dateKey = event.createdAt.slice(0, 10);
          const current = days.get(dateKey) ?? {
            dailyDiary: 0,
            firstEntry: event,
            ownerNote: 0,
            total: 0
          };
          days.set(dateKey, {
            dailyDiary: current.dailyDiary + (event.type === "daily_diary" ? 1 : 0),
            firstEntry: current.firstEntry,
            ownerNote: current.ownerNote + (event.type === "owner_note" ? 1 : 0),
            total: current.total + 1
          });

          return days;
        },
        new Map<
          string,
          {
            dailyDiary: number;
            firstEntry: (typeof archiveItems)[number];
            ownerNote: number;
            total: number;
          }
        >()
      )
      .entries()
  )
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 5)
    .map(([dateKey, counts]) => ({
      ...counts,
      dateKey,
      isToday: dateKey === todayDateKey,
      label: new Date(dateKey + "T00:00:00").toLocaleDateString("zh-CN", {
        day: "2-digit",
        month: "2-digit"
      })
    }));

  return (
    <main className="cloud-pets-page">
      {pet ? (
        <HomepageVisitTracker
          petNo={petNo}
          source={archive === "all" ? "homepage" : "archive_filter"}
        />
      ) : null}
      <SiteHeader />

      <section className="cloud-pets-hero cloud-pets-hero--compact">
        <div className="cloud-pets-hero__inner">
          <p className="section__kicker">宠物主页</p>
          <h1>{pet ? `${pet.name} 的专属主页` : "宠物主页"}</h1>
          <p>
            专属主页用于承接分享、复访和商城转化。每只宠物都有自己的编号、成长状态与互动时间线。
          </p>
        </div>
      </section>

      <section className="cloud-pets-section">
        {pet ? (
          <>
            {partialLoadSections.length > 0 ? (
              <div
                className="cloud-card cloud-status cloud-status--error"
                data-testid="pet-public-partial-warning"
                role="status"
              >
                <strong>部分内容暂时未加载</strong>
                <span>{partialLoadSections.join("、")}</span>
                <Link
                  className="cloud-link-button cloud-link-button--compact"
                  href={
                    archive === "all"
                      ? `/cloud-pets/${pet.petNo}`
                      : `/cloud-pets/${pet.petNo}?archive=${archive}`
                  }
                >
                  重新加载
                </Link>
              </div>
            ) : null}
            <article
              className={`cloud-card pet-homepage-detail pet-homepage-detail--${pet.homepage.theme}`}
              data-testid="pet-public-profile"
            >
            <img alt={pet.name} src={pet.avatarUrl} />
            <div>
              <span data-testid="pet-public-pet-no">{pet.petNo}</span>
              <h2>{pet.name}</h2>
              <p>{pet.bio}</p>
              <p className="pet-owner-story">{pet.homepage.ownerStory}</p>
              <div className="pet-growth">
                <div className="pet-growth__header">
                  <strong>{pet.growth.levelLabel}</strong>
                  <span>{getCareStateLabel(pet.growth.careState)}</span>
                </div>
                <div className="pet-growth__bar" aria-label="成长进度">
                  <span style={{ width: `${pet.growth.progressPercent}%` }} />
                </div>
                <p data-testid="pet-public-care-signal">
                  成长值 {pet.growth.experiencePoints}/{pet.growth.nextLevelExperience} /
                  照护分 {pet.growth.careScore} / 今日任务 {pet.growth.todayCompletedTaskCount} /
                  连续照顾 {pet.growth.careStreakDays}天
                </p>
                <small className="pet-growth__prompt">{pet.growth.nextCarePrompt}</small>
              </div>
              <div className="pet-stats">
                <strong>心情 {pet.stats.mood}</strong>
                <strong>精力 {pet.stats.energy}</strong>
                <strong>亲密 {pet.stats.intimacy}</strong>
              </div>
              <div className="pet-homepage-actions">
                <PublicPetViewer petNo={pet.petNo} />
                <Link className="cloud-link-button cloud-link-button--light" href="/shop">
                  去商城挑礼物
                </Link>
              </div>
              {homepageArchive ? (
                <div className="pet-share-card" data-testid="pet-public-share-card">
                  <span>分享卡片</span>
                  <strong>{homepageArchive.share.title}</strong>
                  <p>{homepageArchive.share.description}</p>
                  <code data-testid="pet-public-share-url">{homepageArchive.share.url}</code>
                  <em data-testid="pet-public-visit-count">{homepageArchive.engagement.homepageVisitCount} 次主页访问</em>
                  <Link className="cloud-link-button cloud-link-button--light" data-testid="pet-public-open-archive" href={`/cloud-pets/${pet.petNo}?archive=all`}>查看归档</Link>
                  <Link className="cloud-link-button cloud-link-button--light" data-testid="pet-public-open-community" href="#pet-public-community">查看互动</Link>
                  <Link className="cloud-link-button cloud-link-button--light" data-testid="pet-public-create-own" href="/cloud-pets">创建我的云养宠</Link>
                </div>
              ) : null}
              <div className="pet-public-insights">
                <section className="pet-public-panel" data-testid="pet-public-today-status">
                  <p className="section__kicker">今日照护</p>
                  <h3>{pet.growth.isCareCompleteToday ? "今日已照顾" : "今日待照顾"}</h3>
                  <p>
                    {pet.growth.isCareCompleteToday
                      ? "今天的成长任务已完成，日记会展示在归档里。"
                      : "还没有完成今日照顾任务。"}
                  </p>
                  {todayDailyDiary ? (
                    <div data-testid="pet-public-today-diary-present">
                      <strong>{todayDailyDiary.title}</strong>
                      <p>{todayDailyDiary.body}</p>
                      <Link
                        className="pet-timeline__entry-link"
                        data-testid="pet-public-today-diary-link"
                        href={`/cloud-pets/${pet.petNo}?archive=daily_diary#${getDiaryShareAnchor(todayDailyDiary)}`}
                      >
                        在归档中查看今日日记
                      </Link>
                    </div>
                  ) : (
                    <p className="cloud-muted" data-testid="pet-public-today-diary-missing">
                      今日生成日记暂未公开。
                    </p>
                  )}
                </section>
                <section className="pet-public-panel" data-testid="pet-public-recent-diaries">
                  <p className="section__kicker">近期日记</p>
                  <h3>最新照护日记</h3>
                  {recentDiaryEntries.length > 0 ? (
                    <ol>
                      {recentDiaryEntries.map((entry) => (
                        <li key={entry.createdAt}>
                          <strong>{entry.title}</strong>
                          <span>{new Date(entry.createdAt).toLocaleDateString("zh-CN")}</span>
                          <p>{entry.body}</p>
                          <Link
                            className="pet-timeline__entry-link"
                            data-testid="pet-public-recent-diary-link"
                            href={`/cloud-pets/${pet.petNo}?archive=${entry.type}#${getDiaryShareAnchor(entry)}`}
                          >
                            打开归档
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="cloud-muted">还没有公开日记，回到工作台完成今日照护后就会出现在这里。</p>
                  )}
                </section>
                <section className="pet-public-panel" data-testid="pet-public-diary-calendar">
                  <p className="section__kicker">日记日历</p>
                  <h3>公开记录</h3>
                  {publicDiaryDays.length > 0 ? (
                    <ol>
                      {publicDiaryDays.map((day) => (
                        <li key={day.dateKey}>
                          <strong>{day.label}</strong>
                          <span>{day.isToday ? "今天" : day.dateKey}</span>
                          <p>{day.total} 条公开记录</p>
                          <small>{day.dailyDiary} 条生成日记 / {day.ownerNote} 条主人手记</small>
                          <Link
                            className="pet-timeline__entry-link"
                            data-testid="pet-public-diary-calendar-link"
                            href={`/cloud-pets/${pet.petNo}?archive=all#${getDiaryShareAnchor(day.firstEntry)}`}
                          >
                            打开这一天
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="cloud-muted">暂无公开日记日历。</p>
                  )}
                </section>
                <section className="pet-public-panel" data-testid="pet-public-community-posts" id="pet-public-community">
                  <p className="section__kicker">社区</p>
                  <h3>最新互动动态</h3>
                  <p className="cloud-muted" data-testid="pet-public-community-count">{communityPosts.length} 条公开动态</p>
                  <p className="cloud-muted" data-testid="pet-public-community-engagement">{communityEngagementTotal} 次公开互动</p>
                  <p className="cloud-muted" data-testid="pet-public-community-latest">{latestCommunityPost ? `最新动态 ${new Date(latestCommunityPost.createdAt).toLocaleDateString("zh-CN")}` : "暂无公开动态"}</p>
                  {communityPosts.length > 0 ? (
                    <ol>
                      {communityPosts.map((post) => (
                        <li key={post.postNo}>
                          <strong>{post.authorName}</strong>
                          <span>{post.likeCount} 点赞 · {post.commentCount} 评论</span>
                          <small data-testid="pet-public-community-post-date">发布于 {new Date(post.createdAt).toLocaleDateString("zh-CN")}</small>
                          <p>{post.body}</p>
                          <div className="pet-public-comments" data-testid="pet-public-community-comments">
                            {(communityCommentsByPost[post.postNo] ?? []).length > 0 ? (
                              (communityCommentsByPost[post.postNo] ?? []).map((comment) => (
                                <p data-testid="pet-public-community-comment" key={comment.commentNo}>
                                  <strong>{comment.authorName}</strong>
                                  <span>{comment.body}</span>
                                </p>
                              ))
                            ) : (
                              <small>暂无评论</small>
                            )}
                          </div>
                          <Link
                            className="pet-timeline__entry-link"
                            data-testid="pet-public-community-discussion"
                            href={`/community/posts/${encodeURIComponent(post.postNo)}`}
                          >
                            打开讨论
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="cloud-muted">还没有社区动态，主人发布后会成为访客的互动入口。</p>
                  )}
                  <Link
                    className="pet-timeline__entry-link"
                    data-testid="pet-public-community-join"
                    href="/cloud-pets#community"
                  >
                    参与讨论
                  </Link>
                </section>
              </div>
              {homepageArchive ? (
                <div
                  className={
                    homepageArchive.commerceReward.status === "unlocked"
                      ? "pet-reward-card pet-reward-card--unlocked"
                      : "pet-reward-card"
                  }
                >
                  <span>
                    {homepageArchive.commerceReward.status === "unlocked"
                      ? "已解锁"
                      : "待解锁"}
                  </span>
                  <strong>{homepageArchive.commerceReward.title}</strong>
                  <p>{homepageArchive.commerceReward.description}</p>
                  {homepageArchive.commerceReward.couponCode ? (
                    <code>
                      {homepageArchive.commerceReward.couponCode} · -¥
                      {Math.round(
                        (homepageArchive.commerceReward.discountCents ?? 0) / 100
                      )}
                    </code>
                  ) : null}
                  {homepageArchive.commerceReward.recommendedProductTitle ? (
                    <em>{homepageArchive.commerceReward.recommendedProductTitle}</em>
                  ) : null}
                  <Link
                    className="cloud-link-button cloud-link-button--light"
                    href={homepageArchive.commerceReward.ctaHref}
                  >
                    {homepageArchive.commerceReward.ctaLabel}
                  </Link>
                </div>
              ) : null}
            </div>
            {pet.homepage.showGrowthArchive ? (
              <div className="pet-archive">
                {homepageArchive ? (
                  <div className="pet-archive__filters">
                    {homepageArchive.filters.map((filter) => (
                      <Link
                        className={
                          archive === filter.key
                            ? "pet-archive__filter pet-archive__filter--active"
                            : "pet-archive__filter"
                        }
                        aria-current={archive === filter.key ? "page" : undefined}
                        data-testid={`pet-archive-filter-${filter.key}`}
                        href={
                          filter.key === "all"
                            ? `/cloud-pets/${pet.petNo}`
                            : `/cloud-pets/${pet.petNo}?archive=${filter.key}`
                        }
                        key={filter.key}
                      >
                        {filter.label} · {filter.count}
                      </Link>
                    ))}
                  </div>
                ) : null}
                <ol className="pet-timeline pet-timeline--detail">
                  {(homepageArchive?.items ?? pet.timeline).map((event) => (
                    <li className="pet-timeline__entry" data-testid="pet-public-archive-entry" id={getDiaryShareAnchor(event)} key={`${event.type}-${event.createdAt}`}>
                      <div className="pet-timeline__entry-header">
                        <strong>{event.title}</strong>
                        <Link
                          className="pet-timeline__entry-link"
                          data-testid="pet-public-entry-link"
                          href={`/cloud-pets/${pet.petNo}?archive=${event.type}#${getDiaryShareAnchor(event)}`}
                        >
                          条目链接
                        </Link>
                      </div>
                      <span>{event.body}</span>
                      <small className="pet-timeline__target-label">公开归档</small>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {pet.homepage.showMallRecommendations ? (
            <div className="pet-recommendations">
              <p className="section__kicker">商城推荐</p>
              <h3>按 {pet.name} 的档案推荐</h3>
              {recommendations.map((product) => (
                <Link className="cloud-recommendation" href="/shop" key={product.slug}>
                  <strong>{getProductTitleLabel(product.title)}</strong>
                  <span>{product.reason}</span>
                </Link>
              ))}
            </div>
            ) : null}
            </article>
          </>
        ) : (
          <div
            className="cloud-card cloud-empty"
            data-testid="pet-public-load-error"
            role="alert"
          >
            <strong>宠物主页暂时无法打开</strong>
            <span>{loadError}</span>
            <Link className="cloud-link-button" href="/cloud-pets">
              回到云养宠工作台
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function normalizeArchiveFilter(value: string | undefined): ArchiveFilter {
  return value && archiveFilters.has(value as ArchiveFilter)
    ? (value as ArchiveFilter)
    : "all";
}
