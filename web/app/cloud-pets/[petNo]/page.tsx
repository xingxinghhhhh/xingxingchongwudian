import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import type {
  CloudPetHomepageArchive,
  CloudPetProfile,
  CloudPetRecommendation
} from "../cloud-pets-api";
import {
  getCloudPet,
  getCloudPetHomepageArchive,
  getCloudPetRecommendations,
  recordCloudPetHomepageVisit
} from "../cloud-pets-api";

interface PetHomepageProps {
  params: Promise<{
    petNo: string;
  }>;
  searchParams?: Promise<{
    archive?: string;
  }>;
}

function getCareStateLabel(state: CloudPetProfile["growth"]["careState"]) {
  const labels: Record<CloudPetProfile["growth"]["careState"], string> = {
    needs_care: "需要陪伴",
    steady: "状态稳定",
    thriving: "元气满满"
  };

  return labels[state];
}

export default async function PetHomepage({ params, searchParams }: PetHomepageProps) {
  const { petNo } = await params;
  const { archive } = (await searchParams) ?? {};
  let pet: CloudPetProfile | null = null;
  let homepageArchive: CloudPetHomepageArchive | null = null;
  let recommendations: CloudPetRecommendation[] = [];
  let loadError: string | null = null;

  try {
    pet = await getCloudPet(petNo);
    await recordCloudPetHomepageVisit(petNo, {
      source: archive ? "archive_filter" : "homepage"
    }).catch(() => undefined);
    homepageArchive = await getCloudPetHomepageArchive(petNo, {
      eventType: archive
    });
    recommendations = await getCloudPetRecommendations(petNo);
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "宠物主页暂时不可用";
  }

  return (
    <main className="cloud-pets-page">
      <SiteHeader />

      <section className="cloud-pets-hero cloud-pets-hero--compact">
        <div className="cloud-pets-hero__inner">
          <p className="section__kicker">Pet Homepage</p>
          <h1>{pet ? `${pet.name} 的专属主页` : "宠物主页"}</h1>
          <p>
            专属主页用于承接分享、复访和商城转化。每只宠物都有自己的编号、成长状态与互动时间线。
          </p>
        </div>
      </section>

      <section className="cloud-pets-section">
        {pet ? (
          <article
            className={`cloud-card pet-homepage-detail pet-homepage-detail--${pet.homepage.theme}`}
          >
            <img alt={pet.name} src={pet.avatarUrl} />
            <div>
              <span>{pet.petNo}</span>
              <h2>{pet.name}</h2>
              <p>{pet.bio}</p>
              <p className="pet-owner-story">{pet.homepage.ownerStory}</p>
              <div className="pet-growth">
                <div className="pet-growth__header">
                  <strong>{pet.growth.levelLabel}</strong>
                  <span>{getCareStateLabel(pet.growth.careState)}</span>
                </div>
                <div className="pet-growth__bar" aria-label="growth progress">
                  <span style={{ width: `${pet.growth.progressPercent}%` }} />
                </div>
                <p>
                  成长值 {pet.growth.experiencePoints}/{pet.growth.nextLevelExperience} ·
                  照护分 {pet.growth.careScore} · 今日任务 {pet.growth.todayCompletedTaskCount}
                </p>
              </div>
              <div className="pet-stats">
                <strong>心情 {pet.stats.mood}</strong>
                <strong>精力 {pet.stats.energy}</strong>
                <strong>亲密 {pet.stats.intimacy}</strong>
              </div>
              <div className="pet-homepage-actions">
                <Link className="cloud-link-button" href="/cloud-pets">
                  回互动工作台
                </Link>
                <Link className="cloud-link-button cloud-link-button--light" href="/shop">
                  去商城挑礼物
                </Link>
              </div>
              {homepageArchive ? (
                <div className="pet-share-card">
                  <span>Share Card</span>
                  <strong>{homepageArchive.share.title}</strong>
                  <p>{homepageArchive.share.description}</p>
                  <code>{homepageArchive.share.url}</code>
                  <em>{homepageArchive.engagement.homepageVisitCount} homepage visits</em>
                </div>
              ) : null}
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
                      ? "Reward Unlocked"
                      : "Reward Locked"}
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
                          (archive ?? "all") === filter.key
                            ? "pet-archive__filter pet-archive__filter--active"
                            : "pet-archive__filter"
                        }
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
                    <li key={`${event.type}-${event.createdAt}`}>
                      <strong>{event.title}</strong>
                      <span>{event.body}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {pet.homepage.showMallRecommendations ? (
            <div className="pet-recommendations">
              <p className="section__kicker">Recommended Mall Items</p>
              <h3>按 {pet.name} 的档案推荐</h3>
              {recommendations.map((product) => (
                <Link className="cloud-recommendation" href="/shop" key={product.slug}>
                  <strong>{product.title}</strong>
                  <span>{product.reason}</span>
                </Link>
              ))}
            </div>
            ) : null}
          </article>
        ) : (
          <div className="cloud-card cloud-empty" role="alert">
            <strong>主页加载失败</strong>
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
