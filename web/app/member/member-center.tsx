"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { formatCents } from "../shop/shop-api";
import {
  GrowthTaskCompletion,
  MemberProfile,
  completeGrowthTask,
  createMemberAddress,
  getCurrentMemberProfile,
  getMemberProfile,
  loginMember,
  redeemMemberPoints
} from "./member-api";

const defaultPhone = "13800138000";

export function MemberCenter() {
  const [name, setName] = useState("会员伙伴");
  const [phone, setPhone] = useState(defaultPhone);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [status, setStatus] = useState("输入手机号查看会员、宠物、订单和成长任务。");
  const [error, setError] = useState<string | null>(null);
  const [busyTaskKey, setBusyTaskKey] = useState<string | null>(null);
  const [busyRewardKey, setBusyRewardKey] = useState<string | null>(null);
  const [taskNextActions, setTaskNextActions] = useState<
    GrowthTaskCompletion["nextActions"]
  >([]);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  useEffect(() => {
    const queryPhone = new URLSearchParams(window.location.search).get("phone");
    const storedSession = localStorage.getItem("kzt_member_session");
    const storedPhone =
      queryPhone ?? localStorage.getItem("kzt_member_phone") ?? defaultPhone;
    const storedName = localStorage.getItem("kzt_member_name") ?? "会员伙伴";

    setName(storedName);
    setPhone(storedPhone);

    if (storedSession && !queryPhone) {
      setSessionToken(storedSession);
      void loadCurrentProfile(storedSession);
      return;
    }

    void loadProfile(storedPhone);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const login = await loginMember({ name, phone });
      setSessionToken(login.sessionToken);
      localStorage.setItem("kzt_member_session", login.sessionToken);
      localStorage.setItem("kzt_member_name", login.member.name);
      localStorage.setItem("kzt_member_phone", login.member.phone);
      await loadCurrentProfile(login.sessionToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "会员登录失败");
    }
  }

  async function handleLegacyLookup() {
    setSessionToken(null);
    localStorage.removeItem("kzt_member_session");
    localStorage.setItem("kzt_member_phone", phone);
    await loadProfile(phone);
  }

  async function loadProfile(nextPhone = phone) {
    setError(null);

    try {
      const nextProfile = await getMemberProfile(nextPhone);
      setProfile(nextProfile);
      setName(nextProfile.member.name);
      setStatus(`${nextProfile.member.name} 的会员闭环已加载。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "会员资料加载失败");
    }
  }

  async function loadCurrentProfile(nextSessionToken = sessionToken) {
    if (!nextSessionToken) {
      await loadProfile(phone);
      return;
    }

    setError(null);

    try {
      const nextProfile = await getCurrentMemberProfile(nextSessionToken);
      setProfile(nextProfile);
      setName(nextProfile.member.name);
      setPhone(nextProfile.member.phone);
      setStatus(`${nextProfile.member.name} 的会员会话已同步，宠物成长、订单和推荐已串联。`);
    } catch (caught) {
      setSessionToken(null);
      localStorage.removeItem("kzt_member_session");
      setError(caught instanceof Error ? caught.message : "会员会话已失效，请重新登录");
    }
  }

  async function handleCompleteTask(petNo: string, taskKey: string) {
    setBusyTaskKey(taskKey);
    setError(null);

    try {
      const result = await completeGrowthTask(petNo, taskKey);
      setTaskNextActions(result.nextActions ?? []);
      if (sessionToken) {
        await loadCurrentProfile(sessionToken);
      } else {
        await loadProfile(phone);
      }
      setStatus(
        `${result.pet.name} 完成「${result.completedTask.title}」，亲密度提升到 ${result.pet.stats.intimacy}。`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "成长任务完成失败");
    } finally {
      setBusyTaskKey(null);
    }
  }

  async function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const memberPhone = profile?.member.phone ?? phone;

    setIsSavingAddress(true);
    setError(null);

    try {
      await createMemberAddress(memberPhone, {
        receiverName: String(formData.get("receiverName") ?? ""),
        phone: String(formData.get("phone") ?? memberPhone),
        province: String(formData.get("province") ?? ""),
        city: String(formData.get("city") ?? ""),
        district: String(formData.get("district") ?? ""),
        detail: String(formData.get("detail") ?? ""),
        isDefault: true
      });
      event.currentTarget.reset();
      if (sessionToken) {
        await loadCurrentProfile(sessionToken);
      } else {
        await loadProfile(memberPhone);
      }
      setStatus("Default shipping address saved for future checkout.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Address save failed");
    } finally {
      setIsSavingAddress(false);
    }
  }

  async function handleRedeemPoints(rewardKey: string) {
    const memberPhone = profile?.member.phone ?? phone;

    setBusyRewardKey(rewardKey);
    setError(null);

    try {
      const redemption = await redeemMemberPoints(memberPhone, { rewardKey });

      if (sessionToken) {
        await loadCurrentProfile(sessionToken);
      } else {
        await loadProfile(memberPhone);
      }

      setStatus(
        `积分兑换成功：${redemption.couponCode} 已发放，可在商城结算时使用，剩余 ${redemption.remainingPoints} 积分。`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "积分兑换失败");
    } finally {
      setBusyRewardKey(null);
    }
  }

  const activePet = profile?.pets[0] ?? null;

  return (
    <div className="member-center">
      <section className="member-card member-card--lookup">
        <div>
          <p className="section__kicker">Member Retention</p>
          <h2>会员长期留存中心</h2>
          <p>用手机号把用户、云养宠、订单、社区动态和推荐商品串成一个可持续运营的档案。</p>
        </div>
        <form className="member-lookup" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            会员昵称
            <input
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label>
            会员手机号
            <input
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              required
              value={phone}
            />
          </label>
          <button className="member-button" type="submit">
            登录会员中心
          </button>
          <button
            className="member-button member-button--ghost"
            onClick={() => void handleLegacyLookup()}
            type="button"
          >
            按手机号查询
          </button>
        </form>
        {sessionToken ? (
          <p className="member-session">当前已登录：{profile?.member.name ?? name}</p>
        ) : null}
        <p className={error ? "member-status member-status--error" : "member-status"}>
          {error ?? status}
        </p>
      </section>

      {profile ? (
        <>
          <section className="member-metrics">
            <article>
              <span>会员等级</span>
              <strong>{profile.member.tier}</strong>
            </article>
            <article>
              <span>成长积分</span>
              <strong>{profile.member.points}</strong>
            </article>
            <article>
              <span>云养宠</span>
              <strong>{profile.pets.length}</strong>
            </article>
            <article>
              <span>订单</span>
              <strong>{profile.orders.length}</strong>
            </article>
            <article>
              <span>社区互动</span>
              <strong>
                {profile.communityEngagement.likedPostCount +
                  profile.communityEngagement.commentCount +
                  profile.communityEngagement.followingPetCount}
              </strong>
            </article>
          </section>

          <section className="member-card member-card--wide">
            <div>
              <p className="section__kicker">Address Book</p>
              <h2>Default Shipping Address</h2>
              {profile.defaultAddress ? (
                <p>
                  {profile.defaultAddress.receiverName} /{" "}
                  {profile.defaultAddress.phone} / {profile.defaultAddress.province}{" "}
                  {profile.defaultAddress.city} {profile.defaultAddress.district}{" "}
                  {profile.defaultAddress.detail}
                </p>
              ) : (
                <p className="member-muted">
                  No saved address yet. Add one so checkout can reuse member data.
                </p>
              )}
            </div>
            <form className="member-lookup" onSubmit={(event) => void handleAddressSubmit(event)}>
              <label>
                Receiver
                <input defaultValue={profile.member.name} name="receiverName" required />
              </label>
              <label>
                Phone
                <input defaultValue={profile.member.phone} inputMode="tel" name="phone" required />
              </label>
              <label>
                Province
                <input defaultValue="Guangdong" name="province" required />
              </label>
              <label>
                City
                <input defaultValue="Shenzhen" name="city" required />
              </label>
              <label>
                District
                <input defaultValue="Nanshan" name="district" required />
              </label>
              <label>
                Detail
                <input defaultValue="Cloud Pet Avenue 9" name="detail" required />
              </label>
              <button className="member-button" disabled={isSavingAddress} type="submit">
                {isSavingAddress ? "Saving address" : "Save default address"}
              </button>
            </form>
          </section>

          <section className="member-card member-card--wide member-loyalty">
            <div>
              <p className="section__kicker">Points Ledger</p>
              <h2>积分与等级账本</h2>
              <p>
                当前可用 {profile.loyalty.summary.availablePoints} 积分，累计{" "}
                {profile.loyalty.summary.lifetimePoints} 积分。
                {profile.loyalty.summary.nextTier
                  ? `距离 ${profile.loyalty.summary.nextTier} 还差 ${profile.loyalty.summary.pointsToNextTier} 积分。`
                  : "已经达到最高等级。"}
              </p>
            </div>
            <div className="member-loyalty__rules">
              {profile.loyalty.rules.map((rule) => (
                <article key={rule.eventType}>
                  <strong>{rule.title}</strong>
                  <span>{rule.description}</span>
                </article>
              ))}
            </div>
            <div className="member-redemptions">
              {profile.loyalty.redemptionRewards.map((reward) => {
                const canRedeem =
                  profile.loyalty.summary.availablePoints >= reward.pointsCost;
                const isBusy = busyRewardKey === reward.key;

                return (
                  <article className="member-redemption" key={reward.key}>
                    <div>
                      <strong>{reward.title}</strong>
                      <span>{reward.description}</span>
                      <code className="member-coupon-code">
                        {reward.couponCode} · {reward.pointsCost} points ·{" "}
                        {formatCents(reward.discountCents)} off
                      </code>
                    </div>
                    <button
                      className="member-button member-button--small"
                      disabled={!canRedeem || isBusy}
                      onClick={() => void handleRedeemPoints(reward.key)}
                      type="button"
                    >
                      {isBusy ? "兑换中" : canRedeem ? "兑换" : "积分不足"}
                    </button>
                  </article>
                );
              })}
            </div>
            {profile.loyalty.redemptions.length > 0 ? (
              <div className="member-list">
                {profile.loyalty.redemptions.slice(0, 3).map((redemption) => (
                  <div className="member-row" key={redemption.redemptionNo}>
                    <strong>{redemption.couponCode}</strong>
                    <span>
                      已兑换 {formatCents(redemption.discountCents)} · 剩余{" "}
                      {redemption.remainingPoints} 积分
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="member-loyalty__ledger">
              {profile.loyalty.ledger.slice(0, 6).map((entry) => (
                <article key={`${entry.eventType}-${entry.sourceId}`}>
                  <div>
                    <strong>{entry.description}</strong>
                    <span>{entry.eventType} · {entry.sourceId}</span>
                  </div>
                  <em>{entry.points > 0 ? `+${entry.points}` : entry.points}</em>
                </article>
              ))}
              {profile.loyalty.ledger.length === 0 ? (
                <p className="member-muted">暂无积分流水，完成任务或下单后会自动记录。</p>
              ) : null}
            </div>
          </section>

          <section className="member-card member-card--wide member-activity">
            <div>
              <p className="section__kicker">Retention Calendar</p>
              <h2>成长任务连续记录</h2>
              <p>
                连续 {profile.taskActivity.currentStreakDays} 天活跃，距离{" "}
                {profile.taskActivity.nextMilestone.targetDays} 天习惯还差{" "}
                {profile.taskActivity.nextMilestone.remainingDays} 天。
              </p>
            </div>
            <div className="member-activity__stats">
              <article>
                <span>累计任务</span>
                <strong>{profile.taskActivity.totalCompletedTasks}</strong>
              </article>
              <article>
                <span>活跃天数</span>
                <strong>{profile.taskActivity.activeDays}</strong>
              </article>
              <article>
                <span>最长连续</span>
                <strong>{profile.taskActivity.longestStreakDays}</strong>
              </article>
            </div>
            <div className="member-calendar" aria-label="最近 14 天成长任务日历">
              {profile.taskActivity.calendar.map((day) => (
                <span
                  className={
                    day.completedCount > 0
                      ? "member-calendar__day member-calendar__day--active"
                      : "member-calendar__day"
                  }
                  key={day.date}
                  title={`${day.date} 完成 ${day.completedCount} 个任务`}
                >
                  <small>{day.date.slice(5)}</small>
                  <strong>{day.completedCount}</strong>
                </span>
              ))}
            </div>
          </section>

          <section className="member-card member-card--wide member-commerce">
            <div>
              <p className="section__kicker">Member Commerce</p>
              <h2>会员权益与复购计划</h2>
              <p>
                当前 {profile.commercePlan.tierProgress.currentTier} 等级，
                {profile.commercePlan.tierProgress.nextTier
                  ? `距离 ${profile.commercePlan.tierProgress.nextTier} 还差 ${profile.commercePlan.tierProgress.pointsToNextTier} 积分。`
                  : "已经达到最高等级。"}
              </p>
            </div>
            <div className="member-tier-progress">
              <span
                style={{
                  width: `${profile.commercePlan.tierProgress.progressPercent}%`
                }}
              />
            </div>
            <div className="member-commerce__grid">
              {profile.commercePlan.benefits.map((benefit) => (
                <article
                  className={
                    benefit.unlocked
                      ? "member-benefit member-benefit--unlocked"
                      : "member-benefit"
                  }
                  key={benefit.key}
                >
                  <span>{benefit.unlocked ? "已解锁" : "待解锁"}</span>
                  <strong>{benefit.title}</strong>
                  <p>{benefit.description}</p>
                  {benefit.couponCode ? (
                    <code className="member-coupon-code">
                      {benefit.couponCode} · 立减 {formatCents(benefit.discountCents ?? 0)}
                    </code>
                  ) : null}
                  <Link className="member-link-button" href={benefit.href}>
                    {benefit.ctaLabel}
                  </Link>
                </article>
              ))}
            </div>
            <div className="member-actions">
              {profile.commercePlan.nextBestActions.map((action) => (
                <Link className="member-action" href={action.href} key={action.key}>
                  <strong>{action.title}</strong>
                  <span>{action.description}</span>
                  <em>{action.ctaLabel}</em>
                </Link>
              ))}
            </div>
          </section>

          <section className="member-card member-card--wide member-commerce">
            <div>
              <p className="section__kicker">Personalization</p>
              <h2>千宠千面推荐</h2>
              <p>
                已综合 {profile.personalizationSummary.petCount} 只云养宠、{" "}
                {profile.personalizationSummary.orderCount} 笔订单、{" "}
                {profile.personalizationSummary.communitySignalCount} 个社区信号和{" "}
                {profile.personalizationSummary.cmsSignalCount} 个 CMS 活动生成推荐。
              </p>
            </div>
            <div className="member-commerce__grid">
              {profile.personalizedRecommendations.map((recommendation) => (
                <article className="member-benefit member-benefit--unlocked" key={`${recommendation.type}-${recommendation.targetId}`}>
                  <span>{recommendation.type} / score {recommendation.score}</span>
                  <strong>{recommendation.title}</strong>
                  <p>{recommendation.description}</p>
                  <div className="tag-row">
                    {recommendation.reasonCodes.map((reasonCode) => (
                      <span className="tag" key={reasonCode}>
                        {reasonCode}
                      </span>
                    ))}
                  </div>
                  <Link className="member-link-button" href={recommendation.actionHref}>
                    {recommendation.ctaLabel}
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="member-card member-card--wide">
            <div>
              <p className="section__kicker">Notification Center</p>
              <h2>会员提醒中心</h2>
              <p>订单、物流、成长任务、优惠券和评价邀请会沉淀在这里，方便商家做复访运营。</p>
            </div>
            <div className="member-list">
              {profile.notifications.slice(0, 8).map((notification) => (
                <Link
                  className="member-row"
                  href={notification.actionHref}
                  key={notification.id}
                >
                  <strong>{notification.title}</strong>
                  <span>{notification.body}</span>
                </Link>
              ))}
              {profile.notifications.length === 0 ? (
                <span className="member-muted">暂无提醒，完成订单或成长任务后会自动出现。</span>
              ) : null}
            </div>
          </section>

          <section className="member-grid">
            <article className="member-card">
              <p className="section__kicker">Pets</p>
              <h2>宠物成长档案</h2>
              <div className="member-list">
                {profile.pets.map((pet) => (
                  <div className="member-pet" key={pet.petNo}>
                    <img alt={pet.name} src={pet.avatarUrl} />
                    <div>
                      <strong>{pet.name}</strong>
                      <span>{pet.petNo}</span>
                      <p>心情 {pet.stats.mood} · 精力 {pet.stats.energy} · 亲密 {pet.stats.intimacy}</p>
                    </div>
                  </div>
                ))}
                {profile.pets.length === 0 ? (
                  <Link className="member-link-button" href="/cloud-pets">
                    去定制第一只云养宠
                  </Link>
                ) : null}
              </div>
            </article>

            <article className="member-card">
              <p className="section__kicker">Growth Tasks</p>
              <h2>云养宠成长任务</h2>
              <div className="member-list">
                {profile.growthTasks.map((task) => (
                  <div className="member-task" key={task.key}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.description}</p>
                      <span>+{task.points} 积分 · 亲密 +{task.rewards.intimacy}</span>
                    </div>
                    <button
                      className="member-button member-button--small"
                      disabled={!activePet || busyTaskKey === task.key}
                      onClick={() =>
                        activePet
                          ? void handleCompleteTask(activePet.petNo, task.key)
                          : undefined
                      }
                      type="button"
                    >
                      {busyTaskKey === task.key ? "完成中" : "完成任务"}
                    </button>
                  </div>
                ))}
                {taskNextActions.length > 0 ? (
                  <div className="member-next-actions">
                    {taskNextActions.map((action) => (
                      <Link className="member-link-button" href={action.href} key={action.key}>
                        {action.ctaLabel}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>

            <article className="member-card">
              <p className="section__kicker">Orders</p>
              <h2>订单与消费</h2>
              <div className="member-list">
                {profile.orders.map((order) => (
                  <div className="member-row" key={order.orderNo}>
                    <strong>{order.orderNo}</strong>
                    <span>{order.status} · {formatCents(order.totalCents)}</span>
                  </div>
                ))}
                {profile.orders.length === 0 ? (
                  <Link className="member-link-button" href="/shop">
                    去商城完成第一单
                  </Link>
                ) : null}
              </div>
            </article>

            <article className="member-card">
              <p className="section__kicker">Reviews</p>
              <h2>评价记录</h2>
              <div className="member-list">
                {profile.reviews.map((review) => (
                  <div className="member-row" key={review.reviewNo}>
                    <strong>{review.rating} 星 / {review.productSlug}</strong>
                    <span>{review.status} · {review.body}</span>
                  </div>
                ))}
                {profile.reviews.length === 0 ? (
                  <Link className="member-link-button" href="/shop">
                    去商城提交已完成订单评价
                  </Link>
                ) : null}
              </div>
            </article>

            <article className="member-card">
              <p className="section__kicker">Recommendations</p>
              <h2>个性化商城推荐</h2>
              <div className="member-list">
                {profile.recommendations.map((product) => (
                  <Link className="member-row" href="/shop" key={product.slug}>
                    <strong>{product.title}</strong>
                    <span>{product.reason}</span>
                  </Link>
                ))}
                {profile.recommendations.length === 0 ? (
                  <span className="member-muted">定制云养宠后会出现推荐商品。</span>
                ) : null}
              </div>
            </article>

            <article className="member-card member-card--wide">
              <p className="section__kicker">Community</p>
              <h2>社区互动记录</h2>
              <div className="member-list">
                {profile.communityPosts.map((post) => (
                  <div className="member-row" key={post.postNo}>
                    <strong>{post.petName}</strong>
                    <span>{post.body}</span>
                  </div>
                ))}
                {profile.communityPosts.length === 0 ? (
                  <Link className="member-link-button" href="/cloud-pets">
                    去发布一条宠物动态
                  </Link>
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
