"use client";

import Link from "next/link";
import { FormEvent, startTransition, useEffect, useState } from "react";
import type {
  CloudPetProfile,
  CommunityPost,
  CreateCloudPetInput
} from "./cloud-pets-api";
import {
  createCloudPet,
  createCommunityPost,
  getCloudPet,
  listCommunityPosts
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
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [postBody, setPostBody] = useState(
    "今天它在窗边晒太阳，听见年糕路过时悄悄抬头，又装作没看见。"
  );
  const [status, setStatus] = useState("先定制一只云养宠，再生成它的专属主页。");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    const storedPetNo = localStorage.getItem("kzt_active_cloud_pet");

    void refreshCommunity();

    if (storedPetNo) {
      void getCloudPet(storedPetNo)
        .then((pet) => {
          setActivePet(pet);
          setStatus(`已恢复 ${pet.name} 的专属主页。`);
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

  async function refreshCommunity() {
    try {
      setPosts(await listCommunityPosts());
    } catch {
      setPosts([]);
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
          <PetProfile pet={activePet} />
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
                <span>{post.authorName}</span>
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
        <Link className="cloud-link-button" href="/shop">
          去宠物商城选礼物
        </Link>
      </aside>
    </div>
  );
}

function PetProfile({ pet }: { pet: CloudPetProfile }) {
  return (
    <div className="pet-homepage-card">
      <img alt={pet.name} src={pet.avatarUrl} />
      <div>
        <span>{pet.petNo}</span>
        <h3>{pet.name}</h3>
        <p>{pet.bio}</p>
        <div className="pet-stats">
          <strong>心情 {pet.stats.mood}</strong>
          <strong>精力 {pet.stats.energy}</strong>
          <strong>亲密 {pet.stats.intimacy}</strong>
        </div>
        <Link href={`/cloud-pets/${pet.petNo}`}>打开完整主页</Link>
      </div>
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
