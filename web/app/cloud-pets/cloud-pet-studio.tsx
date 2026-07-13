"use client";

import Link from "next/link";
import { FormEvent, startTransition, useEffect, useState } from "react";
import type {
  CloudPetProfile,
  CloudPetRecommendation,
  CommunityPost,
  CreateCloudPetInput,
  UpdateCloudPetHomepageInput
} from "./cloud-pets-api";
import {
  createCloudPet,
  createCommunityPost,
  commentOnCommunityPost,
  followCloudPet,
  getCloudPet,
  getCloudPetRecommendations,
  likeCommunityPost,
  listCommunityPosts,
  reportCommunityPost,
  updateCloudPetHomepage
} from "./cloud-pets-api";

const defaultPet: CreateCloudPetInput = {
  ownerName: "奶盖和年糕家",
  ownerPhone: "13800138000",
  name: "小奶球",
  personality: "嘴硬但会偷偷靠近，喜欢把开心藏在尾巴里",
  species: "cat" as const
};

export function CloudPetStudio() {
  const [form, setForm] = useState(defaultPet);
  const [activePet, setActivePet] = useState<CloudPetProfile | null>(null);
  const [recommendations, setRecommendations] = useState<
    CloudPetRecommendation[]
  >([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [postBody, setPostBody] = useState(
    "今天它在窗边晒太阳，听见年糕路过时悄悄抬头，又装作没看见。"
  );
  const [status, setStatus] = useState("先定制一只云养宠，再生成它的专属主页。");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [busyInteraction, setBusyInteraction] = useState<string | null>(null);

  useEffect(() => {
    const storedPetNo = localStorage.getItem("kzt_active_cloud_pet");

    void refreshCommunity();

    if (storedPetNo) {
      void getCloudPet(storedPetNo)
        .then((pet) => {
          setActivePet(pet);
          setStatus(`已恢复 ${pet.name} 的专属主页。`);
          void refreshRecommendations(pet.petNo);
        })
        .catch(() => {
          localStorage.removeItem("kzt_active_cloud_pet");
        });
    }
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const pet = await createCloudPet(form);
      localStorage.setItem("kzt_active_cloud_pet", pet.petNo);
      setActivePet(pet);
      await refreshRecommendations(pet.petNo);
      setStatus(`${pet.name} 已创建，专属主页和社区身份都准备好了。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "定制云养宠失败");
    } finally {
      setIsCreating(false);
    }
  }

  async function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activePet) {
      setError("请先定制一只云养宠");
      return;
    }

    setIsPosting(true);
    setError(null);

    try {
      await createCommunityPost({
        authorName: activePet.ownerName,
        body: postBody,
        petNo: activePet.petNo
      });
      setPostBody("");
      setStatus(`${activePet.name} 的社区动态已发布。`);
      startTransition(() => {
        void refreshCommunity();
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "社区动态发布失败");
    } finally {
      setIsPosting(false);
    }
  }

  async function handleLike(post: CommunityPost) {
    if (!activePet) {
      setError("请先定制一只云养宠再互动");
      return;
    }

    setBusyInteraction(`like-${post.postNo}`);
    setError(null);

    try {
      await likeCommunityPost(post.postNo, {
        memberPhone: activePet.ownerPhone,
        authorName: activePet.ownerName
      });
      await refreshCommunity();
      setStatus(`${post.petName} 的动态已点赞。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "点赞失败");
    } finally {
      setBusyInteraction(null);
    }
  }

  async function handleComment(post: CommunityPost) {
    if (!activePet) {
      setError("请先定制一只云养宠再评论");
      return;
    }

    setBusyInteraction(`comment-${post.postNo}`);
    setError(null);

    try {
      await commentOnCommunityPost(post.postNo, {
        memberPhone: activePet.ownerPhone,
        authorName: activePet.ownerName,
        body: `${activePet.name} 也来参与这条互动。`
      });
      await refreshCommunity();
      setStatus(`${post.petName} 的动态已评论。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "评论失败");
    } finally {
      setBusyInteraction(null);
    }
  }

  async function handleReport(post: CommunityPost) {
    if (!activePet) {
      setError("请先定制一只云养宠再举报");
      return;
    }

    setBusyInteraction(`report-${post.postNo}`);
    setError(null);

    try {
      await reportCommunityPost(post.postNo, {
        memberPhone: activePet.ownerPhone,
        reporterName: activePet.ownerName,
        reason: "用户从社区前台提交的内容复核请求。"
      });
      await refreshCommunity();
      setStatus("举报已进入商家后台处理队列。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "举报失败");
    } finally {
      setBusyInteraction(null);
    }
  }

  async function handleFollowPet(pet: CloudPetProfile) {
    setBusyInteraction(`follow-${pet.petNo}`);
    setError(null);

    try {
      await followCloudPet(pet.petNo, {
        followerPhone: pet.ownerPhone,
        followerName: pet.ownerName
      });
      setStatus(`${pet.name} 已加入关注列表，后续可用于复访提醒。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "关注失败");
    } finally {
      setBusyInteraction(null);
    }
  }

  async function handleHomepageUpdate(input: UpdateCloudPetHomepageInput) {
    if (!activePet) {
      setError("请先定制一只云养宠");
      return;
    }

    setError(null);

    try {
      const updatedPet = await updateCloudPetHomepage(activePet.petNo, input);
      setActivePet(updatedPet);
      setStatus(`${updatedPet.name} 的专属主页配置已保存。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "主页配置保存失败");
    }
  }

  async function refreshCommunity() {
    try {
      setPosts(await listCommunityPosts());
    } catch {
      setPosts([]);
    }
  }

  async function refreshRecommendations(petNo: string) {
    try {
      setRecommendations(await getCloudPetRecommendations(petNo));
    } catch {
      setRecommendations([]);
    }
  }

  return (
    <div className="cloud-pets-grid">
      <section className="cloud-card cloud-card--form">
        <p className="section__kicker">Custom Cloud Pet</p>
        <h2>定制云养宠</h2>
        <p>
          先把商家的用户转化成“宠物主人”，后续专属主页、社区内容和商城推荐都会围绕这只宠物展开。
        </p>

        <form className="cloud-form" onSubmit={(event) => void handleCreate(event)}>
          <label>
            主人称呼
            <input
              onChange={(event) =>
                setForm((current) => ({ ...current, ownerName: event.target.value }))
              }
              required
              value={form.ownerName}
            />
          </label>
          <label>
            手机号
            <input
              inputMode="tel"
              onChange={(event) =>
                setForm((current) => ({ ...current, ownerPhone: event.target.value }))
              }
              required
              value={form.ownerPhone}
            />
          </label>
          <label>
            宠物昵称
            <input
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              required
              value={form.name}
            />
          </label>
          <label>
            宠物类型
            <select
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  species: event.target.value as "cat" | "dog"
                }))
              }
              value={form.species}
            >
              <option value="cat">猫猫</option>
              <option value="dog">狗狗</option>
            </select>
          </label>
          <label className="cloud-form__wide">
            性格设定
            <textarea
              onChange={(event) =>
                setForm((current) => ({ ...current, personality: event.target.value }))
              }
              required
              rows={4}
              value={form.personality}
            />
          </label>
          <button className="cloud-button" disabled={isCreating} type="submit">
            {isCreating ? "生成中" : "生成专属主页"}
          </button>
        </form>

        <p className={error ? "cloud-status cloud-status--error" : "cloud-status"}>
          {error ?? status}
        </p>
      </section>

      <section className="cloud-card cloud-homepage" aria-live="polite">
        <p className="section__kicker">Pet Homepage</p>
        <h2>宠物专属主页</h2>
        {activePet ? (
          <>
          <PetProfile
            busyInteraction={busyInteraction}
            onFollow={handleFollowPet}
            pet={activePet}
          />
          <HomepageBuilder
            key={activePet.petNo}
            pet={activePet}
            onSave={handleHomepageUpdate}
          />
          </>
        ) : (
          <div className="cloud-empty">
            <strong>还没有生成宠物主页</strong>
            <span>提交左侧表单后，这里会出现可分享的宠物主页、成长状态和时间线。</span>
          </div>
        )}
      </section>

      <section className="cloud-card cloud-community">
        <p className="section__kicker">Community</p>
        <h2>宠物互动社区</h2>
        <form className="community-form" onSubmit={(event) => void handlePost(event)}>
          <textarea
            disabled={!activePet}
            onChange={(event) => setPostBody(event.target.value)}
            placeholder="记录今天的互动故事"
            required
            rows={4}
            value={postBody}
          />
          <button className="cloud-button" disabled={!activePet || isPosting} type="submit">
            {isPosting ? "发布中" : "发布动态"}
          </button>
        </form>

        <div className="community-feed">
          {posts.length > 0 ? (
            posts.map((post) => (
              <article className="community-post" key={post.postNo}>
                <strong>{post.petName}</strong>
                <p>{post.body}</p>
                <span>
                  {post.authorName} · {post.likeCount} likes · {post.commentCount} comments
                </span>
                {post.commerceBridge ? (
                  <Link className="cloud-recommendation" href={post.commerceBridge.ctaHref}>
                    <strong>
                      {post.commerceBridge.recommendedProduct?.title ??
                        post.commerceBridge.ctaLabel}
                    </strong>
                    <span>{post.commerceBridge.reason}</span>
                  </Link>
                ) : null}
                <div className="admin-inline-actions">
                  <button
                    className="cloud-button"
                    disabled={!activePet || busyInteraction === `like-${post.postNo}`}
                    onClick={() => void handleLike(post)}
                    type="button"
                  >
                    点赞
                  </button>
                  <button
                    className="cloud-button"
                    disabled={!activePet || busyInteraction === `comment-${post.postNo}`}
                    onClick={() => void handleComment(post)}
                    type="button"
                  >
                    评论
                  </button>
                  <button
                    className="cloud-button"
                    disabled={!activePet || busyInteraction === `report-${post.postNo}`}
                    onClick={() => void handleReport(post)}
                    type="button"
                  >
                    举报
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="cloud-muted">社区还在等第一条宠物动态。</p>
          )}
        </div>
      </section>

      <aside className="cloud-card cloud-shop-bridge">
        <p className="section__kicker">Pet Mall</p>
        <h2>宠物商城联动</h2>
        <p>
          云养宠档案可以继续驱动商品推荐：猫猫优先逗猫棒和猫抓配件，狗狗优先耐咬玩具与互动训练用品。
        </p>
        {recommendations.length > 0 ? (
          <div className="cloud-recommendations">
            {recommendations.map((product) => (
              <Link
                className="cloud-recommendation"
                href="/shop"
                key={product.slug}
              >
                <strong>{product.title}</strong>
                <span>{product.reason}</span>
              </Link>
            ))}
          </div>
        ) : null}
        <Link className="cloud-link-button" href="/shop">
          去宠物商城选礼物
        </Link>
      </aside>
    </div>
  );
}

function getCareStateLabel(state: CloudPetProfile["growth"]["careState"]) {
  const labels: Record<CloudPetProfile["growth"]["careState"], string> = {
    needs_care: "需要陪伴",
    steady: "状态稳定",
    thriving: "元气满满"
  };

  return labels[state];
}

function HomepageBuilder({
  onSave,
  pet
}: {
  onSave: (input: UpdateCloudPetHomepageInput) => Promise<void>;
  pet: CloudPetProfile;
}) {
  const [form, setForm] = useState<UpdateCloudPetHomepageInput>({
    headline: pet.homepage.headline,
    ownerStory: pet.homepage.ownerStory,
    showGrowthArchive: pet.homepage.showGrowthArchive,
    showMallRecommendations: pet.homepage.showMallRecommendations,
    theme: pet.homepage.theme
  });
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await onSave(form);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="homepage-builder" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <p className="section__kicker">Homepage Builder</p>
        <h3>专属主页配置</h3>
        <p>调整主题、头图文案和成长/商城模块，让分享页更像一只宠物自己的小空间。</p>
      </div>
      <label>
        主页主题
        <select
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              theme: event.target.value as UpdateCloudPetHomepageInput["theme"]
            }))
          }
          value={form.theme}
        >
          <option value="sunny">暖阳日记</option>
          <option value="forest">森林陪伴</option>
          <option value="midnight">夜晚星窝</option>
        </select>
      </label>
      <label>
        主页标题
        <input
          maxLength={80}
          onChange={(event) =>
            setForm((current) => ({ ...current, headline: event.target.value }))
          }
          required
          value={form.headline}
        />
      </label>
      <label className="homepage-builder__wide">
        主人故事
        <textarea
          maxLength={240}
          onChange={(event) =>
            setForm((current) => ({ ...current, ownerStory: event.target.value }))
          }
          required
          rows={3}
          value={form.ownerStory}
        />
      </label>
      <label className="homepage-builder__toggle">
        <input
          checked={form.showGrowthArchive}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              showGrowthArchive: event.target.checked
            }))
          }
          type="checkbox"
        />
        展示成长档案
      </label>
      <label className="homepage-builder__toggle">
        <input
          checked={form.showMallRecommendations}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              showMallRecommendations: event.target.checked
            }))
          }
          type="checkbox"
        />
        展示商城推荐
      </label>
      <button className="cloud-button" disabled={isSaving} type="submit">
        {isSaving ? "保存中" : "保存主页配置"}
      </button>
    </form>
  );
}

function PetProfile({
  busyInteraction,
  onFollow,
  pet
}: {
  busyInteraction: string | null;
  onFollow: (pet: CloudPetProfile) => Promise<void>;
  pet: CloudPetProfile;
}) {
  return (
    <div className="pet-homepage-card">
      <img alt={pet.name} src={pet.avatarUrl} />
      <div>
        <span>{pet.petNo}</span>
        <h3>{pet.name}</h3>
        <p>{pet.bio}</p>
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
        <Link href={`/cloud-pets/${pet.petNo}`}>打开完整主页</Link>
      </div>
      <button
        className="cloud-button"
        disabled={busyInteraction === `follow-${pet.petNo}`}
        onClick={() => void onFollow(pet)}
        type="button"
      >
        关注这只宠物
      </button>
      <ol className="pet-timeline">
        {pet.timeline.map((event) => (
          <li key={`${event.type}-${event.createdAt}`}>
            <strong>{event.title}</strong>
            <span>{event.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
