import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import { getCloudPet } from "../cloud-pets-api";

interface PetHomepageProps {
  params: Promise<{
    petNo: string;
  }>;
}

export default async function PetHomepage({ params }: PetHomepageProps) {
  const { petNo } = await params;
  let pet = null;
  let loadError: string | null = null;

  try {
    pet = await getCloudPet(petNo);
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
          <article className="cloud-card pet-homepage-detail">
            <img alt={pet.name} src={pet.avatarUrl} />
            <div>
              <span>{pet.petNo}</span>
              <h2>{pet.name}</h2>
              <p>{pet.bio}</p>
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
            </div>
            <ol className="pet-timeline pet-timeline--detail">
              {pet.timeline.map((event) => (
                <li key={`${event.type}-${event.createdAt}`}>
                  <strong>{event.title}</strong>
                  <span>{event.body}</span>
                </li>
              ))}
            </ol>
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
