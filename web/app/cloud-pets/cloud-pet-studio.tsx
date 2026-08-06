"use client";

import Link from "next/link";
import {
  FormEvent,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  CloudPetProfile,
  CloudPetRecommendation,
  CommunityComment,
  CommunityPost,
  CreateCloudPetInput,
  UpdateCloudPetHomepageInput
} from "./cloud-pets-api";
import {
  createCloudPet,
  createCloudPetDiaryNote,
  createCommunityPost,
  deleteCloudPetDiaryNote,
  commentOnCommunityPost,
  followCloudPet,
  getCloudPetRecommendations,
  likeCommunityPost,
  listCommunityComments,
  listCommunityPosts,
  listFollowedCommunityPosts,
  reportCommunityPost,
  updateCloudPetDiaryNote,
  updateCloudPetHomepage
} from "./cloud-pets-api";
import {
  completeGrowthTask,
  getCurrentMemberProfile,
  loginMember,
  logoutMember,
  requestMemberVerification,
  type GrowthTask,
  type GrowthTaskCompletion,
  type MemberProfile
} from "../member/member-api";
import { getGrowthTaskCopy } from "./cloud-pet-copy";
import { getProductTitleLabel } from "../shop/shop-copy";

const memberSessionKey = "kzt_member_session";
const memberNameKey = "kzt_member_name";
const memberPhoneKey = "kzt_member_phone";
const activePetKey = "kzt_active_cloud_pet";

const communityReportReasons = [
  "内容与宠物社区无关",
  "疑似广告或引流",
  "不友善或骚扰内容",
  "需要运营人员复核"
];

const defaultPet: CreateCloudPetInput = {
  ownerName: "奶盖和年糕家",
  ownerPhone: "13800138000",
  name: "小奶球",
  personality: "嘴硬但会偷偷靠近，喜欢把开心藏在尾巴里",
  species: "cat" as const
};

export function CloudPetStudio() {
  const [form, setForm] = useState(defaultPet);
  const [memberSession, setMemberSession] = useState<string | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [activePet, setActivePet] = useState<CloudPetProfile | null>(null);
  const [recommendations, setRecommendations] = useState<CloudPetRecommendation[]>([]);
  const [recommendationsForPetNo, setRecommendationsForPetNo] =
    useState<string | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [followedPosts, setFollowedPosts] = useState<CommunityPost[]>([]);
  const [communityFeedFilter, setCommunityFeedFilter] = useState<"all" | "following" | "my_pet">("all");
  const [isLoadingCommunity, setIsLoadingCommunity] = useState(true);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [reportReasonsByPost, setReportReasonsByPost] = useState<Record<string, string>>({});
  const [followCountsByPet, setFollowCountsByPet] = useState<Record<string, number>>({});
  const [postBody, setPostBody] = useState(
    "今天它在窗边晒太阳，听见年糕路过时悄悄抬头，又装作没看见。"
  );
  const [diaryNoteBody, setDiaryNoteBody] = useState(
    "今天多陪了它一会儿，记录一个只有主人知道的小变化。"
  );
  const [editingDiaryNoteId, setEditingDiaryNoteId] = useState<string | null>(null);
  const [editingDiaryNoteBody, setEditingDiaryNoteBody] = useState("");
  const [diaryFilter, setDiaryFilter] = useState<"all" | "daily_diary" | "owner_note">("all");
  const [selectedDiaryDate, setSelectedDiaryDate] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "先同步会员或创建云养宠，工作台会展示今日照顾、成长任务和社区动态。"
  );
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isSavingDiaryNote, setIsSavingDiaryNote] = useState(false);
  const [isSyncingMember, setIsSyncingMember] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [memberChallengeId, setMemberChallengeId] = useState<string | null>(null);
  const [memberVerificationCode, setMemberVerificationCode] = useState("");
  const [isRequestingMemberCode, setIsRequestingMemberCode] = useState(false);
  const [busyTaskKey, setBusyTaskKey] = useState<string | null>(null);
  const [busyInteraction, setBusyInteraction] = useState<string | null>(null);
  const [busyDiaryNoteId, setBusyDiaryNoteId] = useState<string | null>(null);
  const [taskNextActions, setTaskNextActions] = useState<
    GrowthTaskCompletion["nextActions"]
  >([]);
  const workspaceRequestId = useRef(0);
  const recommendationRequestId = useRef(0);
  const communityRequestId = useRef(0);

  const memberPets = memberProfile?.pets ?? [];
  const growthTasks = memberProfile?.growthTasks ?? [];
  const activePetFromMember = useMemo(
    () => memberPets.find((pet) => pet.petNo === activePet?.petNo) ?? activePet,
    [activePet, memberPets]
  );
  const completedTaskKeys = useMemo(
    () => new Set(activePetFromMember?.growth.todayCompletedTaskKeys ?? []),
    [activePetFromMember]
  );
  const diaryArchiveEntries = useMemo(
    () =>
      activePetFromMember?.timeline.filter(
        (event) => event.type === "daily_diary" || event.type === "owner_note"
      ) ?? [],
    [activePetFromMember]
  );
  const filteredDiaryEntries = useMemo(
    () =>
      diaryArchiveEntries.filter((event) => {
        const matchesType = diaryFilter === "all" || event.type === diaryFilter;
        const matchesDate = !selectedDiaryDate || event.createdAt.startsWith(selectedDiaryDate);

        return matchesType && matchesDate;
      }),
    [diaryArchiveEntries, diaryFilter, selectedDiaryDate]
  );
  const diaryFilterCounts = useMemo(
    () => ({
      all: diaryArchiveEntries.length,
      dailyDiary: diaryArchiveEntries.filter((event) => event.type === "daily_diary").length,
      ownerNote: diaryArchiveEntries.filter((event) => event.type === "owner_note").length
    }),
    [diaryArchiveEntries]
  );
  const todayDateKey = new Date().toISOString().slice(0, 10);
  const recentDailyDiaries = filteredDiaryEntries.slice(0, 6);
  const latestDailyDiary = diaryArchiveEntries[0] ?? null;
  const diaryCalendarDays = useMemo(() => {
    const days = new Map<string, { dailyDiary: number; ownerNote: number; total: number }>();

    diaryArchiveEntries.forEach((entry) => {
      const dateKey = entry.createdAt.slice(0, 10);
      const current = days.get(dateKey) ?? { dailyDiary: 0, ownerNote: 0, total: 0 };
      days.set(dateKey, {
        dailyDiary: current.dailyDiary + (entry.type === "daily_diary" ? 1 : 0),
        ownerNote: current.ownerNote + (entry.type === "owner_note" ? 1 : 0),
        total: current.total + 1
      });
    });

    return Array.from(days.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, 7)
      .map(([dateKey, counts]) => ({
        ...counts,
        dateKey,
        isToday: dateKey === todayDateKey,
        label: new Date(dateKey + "T00:00:00").toLocaleDateString("zh-CN", {
          day: "2-digit",
          month: "2-digit"
        })
      }));
  }, [diaryArchiveEntries, todayDateKey]);
  const displayedCommunityPosts = useMemo(() => {
    if (communityFeedFilter === "following") {
      return followedPosts;
    }

    if (communityFeedFilter === "my_pet" && activePetFromMember) {
      return posts.filter((post) => post.petNo === activePetFromMember.petNo);
    }

    return posts;
  }, [activePetFromMember, communityFeedFilter, followedPosts, posts]);
  const todayDailyDiary = useMemo(
    () =>
      activePetFromMember?.timeline.find(
        (event) => event.type === "daily_diary" && event.createdAt.startsWith(todayDateKey)
      ) ?? null,
    [activePetFromMember, todayDateKey]
  );
  const hasTodayCommunityPost = useMemo(
    () =>
      activePetFromMember
        ? posts.some(
            (post) =>
              post.petNo === activePetFromMember.petNo && post.createdAt.startsWith(todayDateKey)
          )
        : false,
    [activePetFromMember, posts, todayDateKey]
  );
  const isCreateOwnerLocked = Boolean(memberProfile);
  const communityEngagement = memberProfile?.communityEngagement;
  const communitySignalTotal = communityEngagement
    ? communityEngagement.likedPostCount +
      communityEngagement.commentCount +
      communityEngagement.followingPetCount +
      communityEngagement.reportCount
    : 0;
  const workspaceReminders = getCloudPetWorkspaceReminders(
    activePetFromMember,
    todayDailyDiary,
    hasTodayCommunityPost,
    memberProfile?.notifications ?? []
  );

  useEffect(() => {
    const storedSession = localStorage.getItem(memberSessionKey);
    const storedName = localStorage.getItem(memberNameKey);
    const storedPhone = localStorage.getItem(memberPhoneKey);
    const storedPetNo = localStorage.getItem(activePetKey);

    void refreshCommunity();

    if (storedName || storedPhone) {
      setForm((current) => ({
        ...current,
        ownerName: storedName ?? current.ownerName,
        ownerPhone: storedPhone ?? current.ownerPhone
      }));
    }

    if (storedSession) {
      setMemberSession(storedSession);
      void loadMemberWorkspace(storedSession, storedPetNo ?? undefined).finally(
        () => setIsRestoringSession(false)
      );
      return;
    }

    if (storedPetNo) {
      localStorage.removeItem(activePetKey);
    }
    setIsRestoringSession(false);
  }, []);

  function rememberMemberIdentity(name: string, phone: string) {
    localStorage.setItem(memberNameKey, name);
    localStorage.setItem(memberPhoneKey, phone);
  }

  function clearInvalidMemberSession() {
    workspaceRequestId.current += 1;
    recommendationRequestId.current += 1;
    communityRequestId.current += 1;
    localStorage.removeItem(memberSessionKey);
    localStorage.removeItem(activePetKey);
    setMemberSession(null);
    setMemberProfile(null);
    setActivePet(null);
    setRecommendations([]);
    setRecommendationsForPetNo(null);
    setIsLoadingRecommendations(false);
    setRecommendationError(null);
    setFollowedPosts([]);
    setCommunityFeedFilter("all");
    setIsLoadingCommunity(false);
    setCommunityError(null);
    setCommentDrafts({});
    setReportReasonsByPost({});
    setTaskNextActions([]);
    setEditingDiaryNoteId(null);
    setEditingDiaryNoteBody("");
    setIsSyncingMember(false);
    setError("登录状态已失效，请重新获取验证码。");
  }

  function handleMemberActionError(caught: unknown, fallbackMessage: string) {
    if (isInvalidMemberSessionError(caught)) {
      clearInvalidMemberSession();
      return;
    }

    setError(caught instanceof Error ? caught.message : fallbackMessage);
  }

  async function loadMemberWorkspace(sessionToken = memberSession, preferredPetNo?: string) {
    if (!sessionToken) {
      return;
    }

    const requestId = ++workspaceRequestId.current;
    setIsSyncingMember(true);
    setError(null);

    try {
      const profile = await getCurrentMemberProfile(sessionToken);
      const preferredPet = preferredPetNo
        ? profile.pets.find((pet) => pet.petNo === preferredPetNo)
        : null;
      const nextPet = preferredPet ?? profile.pets[0] ?? null;

      if (requestId !== workspaceRequestId.current) {
        return;
      }

      setMemberSession(sessionToken);
      setMemberProfile(profile);
      rememberMemberIdentity(profile.member.name, profile.member.phone);
      setForm((current) => ({
        ...current,
        ownerName: profile.member.name,
        ownerPhone: profile.member.phone
      }));

      if (nextPet) {
        activatePet(nextPet, {
          resetScopedState: activePet?.petNo !== nextPet.petNo
        });
        setStatus(`已同步 ${profile.member.name} 的 ${profile.pets.length} 只云养宠。`);
      } else {
        localStorage.removeItem(activePetKey);
        setActivePet(null);
        setRecommendations([]);
        setRecommendationsForPetNo(null);
        setDiaryFilter("all");
        setSelectedDiaryDate(null);
        setEditingDiaryNoteId(null);
        setEditingDiaryNoteBody("");
        setTaskNextActions([]);
        setStatus("会员已同步，创建第一只云养宠后会出现在这里。");
      }
      await refreshCommunity(sessionToken);
    } catch (caught) {
      if (requestId !== workspaceRequestId.current) {
        return;
      }

      const invalidSession = isInvalidMemberSessionError(caught);

      if (invalidSession) {
        clearInvalidMemberSession();
        return;
      }

      setMemberSession(sessionToken);
      setMemberProfile(null);
      setActivePet(null);
      recommendationRequestId.current += 1;
      setRecommendations([]);
      setRecommendationsForPetNo(null);
      setIsLoadingRecommendations(false);
      setRecommendationError(null);
      communityRequestId.current += 1;
      setFollowedPosts([]);
      setCommunityFeedFilter("all");
      setIsLoadingCommunity(false);
      setCommunityError(null);
      setError(
        "会员工作台同步失败，请稍后重试。"
      );
    } finally {
      if (requestId === workspaceRequestId.current) {
        setIsSyncingMember(false);
      }
    }
  }

  function activatePet(
    pet: CloudPetProfile,
    options: { resetScopedState?: boolean } = {}
  ) {
    if (options.resetScopedState) {
      setDiaryFilter("all");
      setSelectedDiaryDate(null);
      setEditingDiaryNoteId(null);
      setEditingDiaryNoteBody("");
      setTaskNextActions([]);
    }

    localStorage.setItem(activePetKey, pet.petNo);
    setActivePet(pet);
    return refreshRecommendations(pet.petNo);
  }

  function handlePetSwitch(pet: CloudPetProfile) {
    if (pet.petNo === activePetFromMember?.petNo) {
      return;
    }

    void activatePet(pet, { resetScopedState: true });
    setStatus(`已切换到 ${pet.name}，今日照顾、日记和主页已更新。`);
  }

  function handleWorkspaceRetry() {
    if (!memberSession) {
      return;
    }

    const preferredPetNo = localStorage.getItem(activePetKey) ?? undefined;
    void loadMemberWorkspace(memberSession, preferredPetNo);
  }

  function incrementCommunityEngagementCounter(
    key: keyof MemberProfile["communityEngagement"]
  ) {
    setMemberProfile((current) =>
      current
        ? {
            ...current,
            communityEngagement: {
              ...current.communityEngagement,
              [key]: current.communityEngagement[key] + 1
            }
          }
        : current
    );
  }

  async function handleMemberLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ownerName = form.ownerName.trim();
    const ownerPhone = form.ownerPhone.trim();

    if (
      !ownerName ||
      !ownerPhone ||
      !memberChallengeId ||
      !memberVerificationCode.trim()
    ) {
      setError("请先获取并填写短信验证码");
      return;
    }

    setIsSyncingMember(true);
    setError(null);

    try {
      const login = await loginMember({
        challengeId: memberChallengeId,
        code: memberVerificationCode.trim()
      });
      localStorage.setItem(memberSessionKey, login.sessionToken);
      rememberMemberIdentity(login.member.name, login.member.phone);
      await loadMemberWorkspace(login.sessionToken);
      setMemberChallengeId(null);
      setMemberVerificationCode("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "会员同步失败");
    } finally {
      setIsSyncingMember(false);
    }
  }

  async function handleRequestMemberVerification() {
    const ownerName = form.ownerName.trim();
    const ownerPhone = form.ownerPhone.trim();

    if (!ownerName || !/^1[3-9]\d{9}$/.test(ownerPhone)) {
      setError("请填写有效的会员称呼和手机号");
      return;
    }

    setIsRequestingMemberCode(true);
    setError(null);

    try {
      const challenge = await requestMemberVerification({
        name: ownerName,
        phone: ownerPhone
      });
      setMemberChallengeId(challenge.challengeId);
      setMemberVerificationCode(challenge.developmentCode ?? "");
      setStatus(
        challenge.developmentCode
          ? "开发验证码已自动填入，可以同步会员云养宠。"
          : "验证码已发送，请在 5 分钟内完成同步。"
      );
    } catch (caught) {
      setMemberChallengeId(null);
      setError(caught instanceof Error ? caught.message : "验证码发送失败");
    } finally {
      setIsRequestingMemberCode(false);
    }
  }

  async function handleMemberLogout() {
    const currentSession = memberSession;
    workspaceRequestId.current += 1;
    recommendationRequestId.current += 1;
    communityRequestId.current += 1;
    setIsSyncingMember(true);
    setError(null);

    try {
      if (currentSession) {
        await logoutMember(currentSession);
      }
      setStatus("已安全退出，重新同步会员后才能创建或照顾云养宠。");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `服务器退出失败，本机会话已清除：${caught.message}`
          : "服务器退出失败，本机会话已清除"
      );
    } finally {
      localStorage.removeItem(memberSessionKey);
      localStorage.removeItem(activePetKey);
      setMemberSession(null);
      setMemberProfile(null);
      setActivePet(null);
      setRecommendations([]);
      setRecommendationsForPetNo(null);
      setIsLoadingRecommendations(false);
      setRecommendationError(null);
      setTaskNextActions([]);
      setFollowedPosts([]);
      setCommunityFeedFilter("all");
      setIsLoadingCommunity(false);
      setCommunityError(null);
      setIsSyncingMember(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedCreateForm = {
      ...form,
      name: form.name.trim(),
      ownerName: form.ownerName.trim(),
      personality: form.personality.trim()
    };

    if (!trimmedCreateForm.name || !trimmedCreateForm.personality || (!memberProfile && !trimmedCreateForm.ownerName)) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      if (!memberSession || !memberProfile) {
        throw new Error("请先通过短信验证码同步会员，再创建云养宠");
      }

      const createInput = {
        ...trimmedCreateForm,
        ownerName: memberProfile.member.name,
        ownerPhone: memberProfile.member.phone
      };
      const pet = await createCloudPet(createInput, memberSession);
      activatePet(pet, { resetScopedState: true });
      await loadMemberWorkspace(memberSession, pet.petNo);

      setStatus(`${pet.name} 已创建，今日照顾、主页和社区身份都准备好了。`);
    } catch (caught) {
      handleMemberActionError(caught, "定制云养宠失败");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCompleteTask(task: GrowthTask) {
    if (!activePetFromMember) {
      setError("请先选择一只云养宠");
      return;
    }

    if (!memberSession) {
      setError("请先同步会员后再完成成长任务");
      return;
    }

    setBusyTaskKey(task.key);
    setError(null);

    try {
      const completion = await completeGrowthTask(activePetFromMember.petNo, task.key, memberSession);
      setTaskNextActions(completion.nextActions);
      setStatus(`${completion.pet.name} 完成了「${getGrowthTaskCopy(task).title}」，成长日记会自动补上今天这一页。`);
      activatePet(completion.pet);

      if (memberSession) {
        await loadMemberWorkspace(memberSession, completion.pet.petNo);
      }
    } catch (caught) {
      handleMemberActionError(caught, "成长任务完成失败");
    } finally {
      setBusyTaskKey(null);
    }
  }

  async function handleDiaryNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activePetFromMember) {
      setError("请先选择一只云养宠");
      return;
    }

    if (!memberSession) {
      setError("请先同步会员后再保存主人手记");
      return;
    }

    const body = diaryNoteBody.trim();

    if (!body) {
      setError("请先写下一段照护手记");
      return;
    }

    setIsSavingDiaryNote(true);
    setError(null);

    try {
      const updatedPet = await createCloudPetDiaryNote(
        activePetFromMember.petNo,
        { body },
        memberSession
      );
      activatePet(updatedPet);
      setDiaryNoteBody("");
      setStatus(`${activePetFromMember.name} 的主人手记已保存到照护档案。`);
      await loadMemberWorkspace(memberSession, updatedPet.petNo);
    } catch (caught) {
      handleMemberActionError(caught, "主人手记保存失败");
    } finally {
      setIsSavingDiaryNote(false);
    }
  }
  function getDiaryNoteId(diary: { id?: string; createdAt: string }) {
    return diary.id ?? diary.createdAt;
  }

  async function handleCopyDiaryLink(diary: CloudPetProfile["timeline"][number]) {
    if (!activePetFromMember) {
      setError("请先同步会员并选择一只云养宠。");
      return;
    }

    const href = getDiaryShareHref(activePetFromMember.petNo, diary);
    const shareUrl = window.location.origin + href;
    setError(null);

    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("公开归档链接已复制。");
    } catch {
      setStatus("公开归档链接：" + shareUrl);
    }
  }

  async function handleCopyHomepageLink(pet: CloudPetProfile) {
    const shareUrl = window.location.origin + getPetHomepageHref(pet.petNo);
    setError(null);

    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("宠物主页链接已复制。");
    } catch {
      setStatus("宠物主页链接：" + shareUrl);
    }
  }

  async function handleCopyCommunityPostLink(post: CommunityPost) {
    const shareUrl = window.location.origin + getCommunityPostHref(post.postNo);
    setError(null);

    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("社区动态链接已复制。");
    } catch {
      setStatus("社区动态链接：" + shareUrl);
    }
  }

  function handleStartDiaryNoteEdit(diary: { id?: string; createdAt: string; body: string }) {
    setEditingDiaryNoteId(getDiaryNoteId(diary));
    setEditingDiaryNoteBody(diary.body);
    setError(null);
  }

  async function handleUpdateDiaryNote(diary: { id?: string; createdAt: string }) {
    if (!activePetFromMember || !memberSession) {
      setError("请先同步会员后再管理主人手记");
      return;
    }

    const body = editingDiaryNoteBody.trim();

    if (!body) {
      setError("主人手记不能为空");
      return;
    }

    const noteId = getDiaryNoteId(diary);
    setBusyDiaryNoteId(noteId);
    setError(null);

    try {
      const updatedPet = await updateCloudPetDiaryNote(
        activePetFromMember.petNo,
        noteId,
        { body },
        memberSession
      );
      activatePet(updatedPet);
      setEditingDiaryNoteId(null);
      setEditingDiaryNoteBody("");
      setStatus("主人手记已更新。");
      await loadMemberWorkspace(memberSession, updatedPet.petNo);
    } catch (caught) {
      handleMemberActionError(caught, "主人手记更新失败");
    } finally {
      setBusyDiaryNoteId(null);
    }
  }

  async function handleDeleteDiaryNote(diary: { id?: string; createdAt: string }) {
    if (!activePetFromMember || !memberSession) {
      setError("请先同步会员后再管理主人手记");
      return;
    }

    const noteId = getDiaryNoteId(diary);
    setBusyDiaryNoteId(noteId);
    setError(null);

    try {
      const updatedPet = await deleteCloudPetDiaryNote(
        activePetFromMember.petNo,
        noteId,
        memberSession
      );
      activatePet(updatedPet);
      setEditingDiaryNoteId((current) => (current === noteId ? null : current));
      setStatus("主人手记已删除。");
      await loadMemberWorkspace(memberSession, updatedPet.petNo);
    } catch (caught) {
      handleMemberActionError(caught, "主人手记删除失败");
    } finally {
      setBusyDiaryNoteId(null);
    }
  }
  async function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activePetFromMember) {
      setError("请先选择一只云养宠");
      return;
    }

    if (!memberSession) {
      setError("请先同步会员后再发布社区动态");
      return;
    }

    const trimmedPostBody = postBody.trim();

    if (!trimmedPostBody) {
      setError("社区动态内容不能为空。");
      return;
    }

    setIsPosting(true);
    setError(null);

    try {
      const createdPost = await createCommunityPost(
        {
          authorName: activePetFromMember.ownerName,
          body: trimmedPostBody,
          petNo: activePetFromMember.petNo
        },
        memberSession
      );
      setPosts((current) => [createdPost, ...current.filter((post) => post.postNo !== createdPost.postNo)]);
      setPostBody("");
      setStatus(`${activePetFromMember.name} 的社区动态已发布。`);
      startTransition(() => {
        void refreshCommunity(memberSession);
      });
    } catch (caught) {
      handleMemberActionError(caught, "社区动态发布失败");
    } finally {
      setIsPosting(false);
    }
  }

  async function handleLike(post: CommunityPost) {
    if (!activePetFromMember) {
      setError("请先选择一只云养宠再互动");
      return;
    }

    if (!memberSession) {
      setError("请先同步会员后再互动");
      return;
    }

    setBusyInteraction(`like-${post.postNo}`);
    setError(null);

    try {
      const like = await likeCommunityPost(
        post.postNo,
        {
          memberPhone: activePetFromMember.ownerPhone,
          authorName: activePetFromMember.ownerName
        },
        memberSession
      );
      const didIncreaseLikeCount = like.likeCount > post.likeCount;
      setPosts((current) =>
        current.map((item) =>
          item.postNo === post.postNo ? { ...item, likeCount: like.likeCount } : item
        )
      );
      setFollowedPosts((current) =>
        current.map((item) =>
          item.postNo === post.postNo ? { ...item, likeCount: like.likeCount } : item
        )
      );
      if (didIncreaseLikeCount) {
        incrementCommunityEngagementCounter("likedPostCount");
      }
      await refreshCommunity();
      setStatus(`${post.petName} 的动态已点赞。`);
    } catch (caught) {
      handleMemberActionError(caught, "点赞失败");
    } finally {
      setBusyInteraction(null);
    }
  }

  async function handleComment(post: CommunityPost) {
    if (!activePetFromMember) {
      setError("请先选择一只云养宠再评论");
      return;
    }

    if (!memberSession) {
      setError("请先同步会员后再评论");
      return;
    }

    const body = (commentDrafts[post.postNo] ?? "").trim();

    if (!body) {
      setError("请输入评论内容");
      return;
    }

    setBusyInteraction(`comment-${post.postNo}`);
    setError(null);

    try {
      const comment = await commentOnCommunityPost(
        post.postNo,
        { body },
        memberSession
      );
      setCommentDrafts((current) => ({ ...current, [post.postNo]: "" }));
      setCommentsByPost((current) => ({
        ...current,
        [post.postNo]: [comment, ...(current[post.postNo] ?? [])].slice(0, 3)
      }));
      setPosts((current) =>
        current.map((item) =>
          item.postNo === post.postNo
            ? { ...item, commentCount: item.commentCount + 1 }
            : item
        )
      );
      setFollowedPosts((current) =>
        current.map((item) =>
          item.postNo === post.postNo
            ? { ...item, commentCount: item.commentCount + 1 }
            : item
        )
      );
      incrementCommunityEngagementCounter("commentCount");
      await refreshCommunity();
      setStatus(`${post.petName} 的动态已评论。`);
    } catch (caught) {
      handleMemberActionError(caught, "评论失败");
    } finally {
      setBusyInteraction(null);
    }
  }

  async function handleReport(post: CommunityPost) {
    if (!activePetFromMember) {
      setError("请先选择一只云养宠再举报");
      return;
    }

    if (!memberSession) {
      setError("请先同步会员后再举报");
      return;
    }

    setBusyInteraction(`report-${post.postNo}`);
    setError(null);

    try {
      const report = await reportCommunityPost(
        post.postNo,
        {
          memberPhone: activePetFromMember.ownerPhone,
          reporterName: activePetFromMember.ownerName,
          reason: reportReasonsByPost[post.postNo] ?? communityReportReasons[0]
        },
        memberSession
      );
      if (report.created) {
        incrementCommunityEngagementCounter("reportCount");
      }
      await refreshCommunity();
      setStatus(
        report.created
          ? "举报已进入商家审核队列。"
          : "举报已更新到商家审核队列。"
      );
    } catch (caught) {
      handleMemberActionError(caught, "举报失败");
    } finally {
      setBusyInteraction(null);
    }
  }

  async function handleFollowPet(pet: CloudPetProfile) {
    if (!memberSession) {
      setError("请先同步会员后再关注宠物。");
      return;
    }

    const follower = activePetFromMember ?? pet;
    setBusyInteraction(`follow-${pet.petNo}`);
    setError(null);

    try {
      const follow = await followCloudPet(
        pet.petNo,
        {
          followerPhone: follower.ownerPhone,
          followerName: follower.ownerName
        },
        memberSession
      );
      setFollowCountsByPet((current) => ({
        ...current,
        [pet.petNo]: follow.followerCount
      }));
      if (follow.created) {
        incrementCommunityEngagementCounter("followingPetCount");
      }
      await refreshCommunity(memberSession);
      setStatus(`已关注${pet.name}，当前有 ${follow.followerCount} 位关注者。`);
    } catch (caught) {
      handleMemberActionError(caught, "关注失败");
    } finally {
      setBusyInteraction(null);
    }
  }

  async function handleHomepageUpdate(input: UpdateCloudPetHomepageInput) {
    if (!activePetFromMember) {
      setError("请先选择一只云养宠");
      return;
    }

    if (!memberSession) {
      setError("请先同步会员后再保存宠物主页");
      return;
    }

    setError(null);

    try {
      const updatedPet = await updateCloudPetHomepage(activePetFromMember.petNo, input, memberSession);
      activatePet(updatedPet);
      setMemberProfile((current) =>
        current
          ? {
              ...current,
              pets: current.pets.map((pet) =>
                pet.petNo === updatedPet.petNo ? updatedPet : pet
              )
            }
          : current
      );
      setStatus(`${updatedPet.name} 的专属主页配置已保存。`);
    } catch (caught) {
      handleMemberActionError(caught, "主页配置保存失败");
    }
  }

  async function refreshCommunity(sessionToken = memberSession) {
    const requestId = ++communityRequestId.current;
    setIsLoadingCommunity(true);
    setCommunityError(null);

    try {
      const items = await listCommunityPosts();
      const nextFollowedPosts = sessionToken
        ? await listFollowedCommunityPosts(sessionToken)
        : [];
      const commentEntries = await Promise.all(
        items.slice(0, 8).map(async (post) => [
          post.postNo,
          await listCommunityComments(post.postNo).catch(() => [])
        ] as const)
      );

      if (requestId !== communityRequestId.current) {
        return;
      }

      setPosts(items);
      setFollowedPosts(nextFollowedPosts);
      setCommentsByPost(Object.fromEntries(commentEntries));
    } catch (caught) {
      if (requestId !== communityRequestId.current) {
        return;
      }

      if (sessionToken && isInvalidMemberSessionError(caught)) {
        clearInvalidMemberSession();
        return;
      }

      setCommunityError("社区动态加载失败，请稍后重试。");
    } finally {
      if (requestId === communityRequestId.current) {
        setIsLoadingCommunity(false);
      }
    }
  }
  async function refreshRecommendations(petNo: string) {
    const requestId = ++recommendationRequestId.current;
    setIsLoadingRecommendations(true);
    setRecommendationError(null);
    setRecommendations([]);
    setRecommendationsForPetNo(null);

    try {
      const items = await getCloudPetRecommendations(petNo);

      if (requestId === recommendationRequestId.current) {
        setRecommendations(items);
        setRecommendationsForPetNo(petNo);
      }
    } catch {
      if (requestId === recommendationRequestId.current) {
        setRecommendations([]);
        setRecommendationsForPetNo(petNo);
        setRecommendationError("推荐加载失败，请重试。");
      }
    } finally {
      if (requestId === recommendationRequestId.current) {
        setIsLoadingRecommendations(false);
      }
    }
  }

  return (
    <div className="cloud-pets-grid">
      <section className="cloud-card cloud-workbench">
        <div className="cloud-workbench__header">
          <div>
            <p className="section__kicker">云养宠工作台</p>
            <h2>我的云养宠工作台</h2>
            <p>围绕会员、宠物、今日照顾和成长任务组织主线体验，商城转化先作为后续入口保留。</p>
          </div>
          {memberProfile ? (
            <div
              className="cloud-workbench__member"
              data-testid="cloud-member-profile"
            >
              <strong>{memberProfile.member.name}</strong>
              <span>{memberProfile.member.phone}</span>
              <span>{memberProfile.member.tier.toUpperCase()} · {memberProfile.member.points} 积分</span>
              <div className="cloud-workbench__member-actions">
                <button
                  className="cloud-button cloud-button--small"
                  data-testid="cloud-member-refresh"
                  disabled={isSyncingMember}
                  onClick={() => void loadMemberWorkspace(memberSession ?? undefined, activePetFromMember?.petNo)}
                  type="button"
                >
                  刷新
                </button>
                <button
                  className="cloud-button cloud-button--small cloud-button--ghost"
                  data-testid="cloud-member-logout"
                  onClick={() => void handleMemberLogout()}
                  type="button"
                >
                  切换
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {memberProfile && workspaceReminders.length > 0 ? (
          <section className="cloud-revisit-reminders" data-testid="cloud-revisit-reminders" aria-label="云养宠回访提醒">
            <strong>今日提醒</strong>
            {workspaceReminders.map((reminder) => (
              <article key={reminder.key}>
                <span>{reminder.label}</span>
                <p>{reminder.description}</p>
                <Link
                  className="cloud-link-button cloud-link-button--compact"
                  data-testid={"cloud-reminder-action-" + reminder.key}
                  href={reminder.href}
                  onClick={() => {
                    if (reminder.key === "share-community" && activePetFromMember && todayDailyDiary) {
                      setPostBody(createCommunityDraftFromDiary(activePetFromMember, todayDailyDiary));
                    }
                  }}
                >
                  {reminder.ctaLabel}
                </Link>
              </article>
            ))}
          </section>
        ) : null}

        {memberProfile && communityEngagement ? (
          <section className="cloud-community-pulse" data-testid="cloud-community-pulse" aria-label="社区互动概览">
            <article>
              <span>互动</span>
              <strong data-testid="cloud-community-signal-total">{communitySignalTotal}</strong>
            </article>
            <article>
              <span>点赞</span>
              <strong data-testid="cloud-community-liked-count">{communityEngagement.likedPostCount}</strong>
            </article>
            <article>
              <span>评论</span>
              <strong data-testid="cloud-community-comment-count">{communityEngagement.commentCount}</strong>
            </article>
            <article>
              <span>关注</span>
              <strong data-testid="cloud-community-following-count">{communityEngagement.followingPetCount}</strong>
            </article>
            <article>
              <span>举报</span>
              <strong data-testid="cloud-community-report-count">{communityEngagement.reportCount}</strong>
            </article>
          </section>
        ) : null}

        {isRestoringSession ? (
          <div
            className="cloud-empty"
            data-testid="cloud-workspace-loading"
            role="status"
          >
            <strong>正在恢复会员工作台</strong>
            <span>正在同步宠物、今日照顾和成长记录。</span>
          </div>
        ) : null}

        {!isRestoringSession && memberSession && !memberProfile ? (
          <div
            className="cloud-empty"
            data-testid="cloud-workspace-recovery-error"
            role="alert"
          >
            <strong>会员工作台暂时未同步</strong>
            <span>{error ?? "请稍后重试同步。"}</span>
            <div className="cloud-diary-actions">
              <button
                className="cloud-button"
                data-testid="cloud-workspace-retry"
                disabled={isSyncingMember}
                onClick={handleWorkspaceRetry}
                type="button"
              >
                {isSyncingMember ? "重试中" : "重新同步"}
              </button>
              <button
                className="cloud-button cloud-button--ghost"
                onClick={() => void handleMemberLogout()}
                type="button"
              >
                退出并重新登录
              </button>
            </div>
          </div>
        ) : null}

        {!isRestoringSession && !memberSession && !memberProfile ? (
          <form className="cloud-form cloud-form--compact" onSubmit={(event) => void handleMemberLogin(event)}>
            <label>
              会员称呼
              <input
                data-testid="cloud-member-name"
                maxLength={40}
                onChange={(event) => {
                  setForm((current) => ({ ...current, ownerName: event.target.value }));
                  setMemberChallengeId(null);
                }}
                required
                value={form.ownerName}
              />
            </label>
            <label>
              手机号
              <input
                data-testid="cloud-member-phone"
                inputMode="tel"
                maxLength={11}
                pattern="1[3-9][0-9]{9}"
                onChange={(event) => {
                  setForm((current) => ({ ...current, ownerPhone: event.target.value }));
                  setMemberChallengeId(null);
                }}
                required
                value={form.ownerPhone}
              />
            </label>
            <label>
              短信验证码
              <input
                autoComplete="one-time-code"
                data-testid="cloud-member-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setMemberVerificationCode(event.target.value)}
                pattern="[0-9]{6}"
                required
                value={memberVerificationCode}
              />
            </label>
            <button
              className="cloud-button cloud-button--ghost"
              data-testid="cloud-member-request-code"
              disabled={isRequestingMemberCode || !form.ownerName.trim() || !form.ownerPhone.trim()}
              onClick={() => void handleRequestMemberVerification()}
              type="button"
            >
              {isRequestingMemberCode ? "发送中" : "获取验证码"}
            </button>
            <button className="cloud-button" data-testid="cloud-member-sync" disabled={isSyncingMember || !memberChallengeId || !memberVerificationCode.trim()} type="submit">
              {isSyncingMember ? "同步中" : "同步会员云养宠"}
            </button>
          </form>
        ) : null}

        {memberPets.length > 0 ? (
          <div className="cloud-pet-switcher" aria-label="选择云养宠">
            {memberPets.map((pet) => (
              <button
                aria-pressed={pet.petNo === activePetFromMember?.petNo}
                className={
                  pet.petNo === activePetFromMember?.petNo
                    ? "cloud-pet-switcher__item cloud-pet-switcher__item--active"
                    : "cloud-pet-switcher__item"
                }
                data-pet-no={pet.petNo}
                data-testid="cloud-pet-switch"
                key={pet.petNo}
                onClick={() => handlePetSwitch(pet)}
                type="button"
              >
                <img alt="" src={pet.avatarUrl} />
                <span>{pet.name}</span>
                <small>{pet.growth.levelLabel}</small>
              </button>
            ))}
          </div>
        ) : null}

        {activePetFromMember ? (
          <>
            <div
              className="cloud-daily-panel"
              data-pet-no={activePetFromMember.petNo}
              data-testid="cloud-daily-panel"
            >
              <div>
                <span>今日照护分</span>
                <strong>{activePetFromMember.growth.careScore}</strong>
                <small>{getCareStateLabel(activePetFromMember.growth.careState)}</small>
              </div>
              <div>
                <span>成长等级</span>
                <strong>{activePetFromMember.growth.levelLabel}</strong>
                <small>{activePetFromMember.growth.progressPercent}% 到下一阶段</small>
              </div>
              <div>
                <span>今日任务</span>
                <strong data-testid="cloud-today-completed-count">{activePetFromMember.growth.todayCompletedTaskCount}</strong>
                <small>完成后自动生成日记</small>
              </div>
              <div>
                <span>连续照顾</span>
                <strong data-testid="cloud-care-streak">{activePetFromMember.growth.careStreakDays}天</strong>
                <small data-testid="cloud-next-care-prompt">{activePetFromMember.growth.nextCarePrompt}</small>
              </div>
            </div>
            <article className="cloud-diary-highlight" data-testid="cloud-today-diary-status">
              <span>今日日记</span>
              {todayDailyDiary ? (
                <div data-testid="cloud-today-diary-present">
                  <strong>{todayDailyDiary.title}</strong>
                  <p>{todayDailyDiary.body}</p>
                </div>
              ) : (
                <div data-testid="cloud-today-diary-missing">
                  <strong>今天还没有照护日记</strong>
                  <p>完成成长任务后，系统会自动补上今天这一页。</p>
                  <a className="cloud-link-button cloud-link-button--compact" data-testid="cloud-start-care-from-diary" href="#cloud-daily-care">去完成照顾</a>
                </div>
              )}
            </article>
            {latestDailyDiary ? (
              <article className="cloud-diary-highlight" data-testid="cloud-latest-diary">
                <span>今日云养宠日记</span>
                <strong>{latestDailyDiary.title}</strong>
                <p>{latestDailyDiary.body}</p>
              </article>
            ) : null}
            {diaryCalendarDays.length > 0 ? (
              <div className="cloud-diary-calendar" data-testid="cloud-diary-calendar">
                <div>
                  <p className="section__kicker">连续记录</p>
                  <h3>照护日历</h3>
                </div>
                <ol>
                  {diaryCalendarDays.map((day) => (
                    <li key={day.dateKey}>
                      <button
                        className={
                          selectedDiaryDate === day.dateKey
                            ? "cloud-diary-calendar__day cloud-diary-calendar__day--selected"
                            : day.isToday
                              ? "cloud-diary-calendar__day cloud-diary-calendar__day--today"
                              : "cloud-diary-calendar__day"
                        }
                        data-testid="cloud-diary-calendar-day"
                        onClick={() => setSelectedDiaryDate(day.dateKey)}
                        type="button"
                      >
                        <strong>{day.label}</strong>
                        <span>{day.isToday ? "今天" : day.dateKey}</span>
                        <em>{day.total} 条记录</em>
                        <small>{day.dailyDiary} 条生成日记 / {day.ownerNote} 条主人手记</small>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <section className="cloud-diary-archive" data-testid="cloud-diary-archive">
              <div>
                <p className="section__kicker">照护归档</p>
                <h3>近期照护日记</h3>
              </div>
              {selectedDiaryDate ? (
                <div className="cloud-diary-date-filter" data-testid="cloud-diary-date-filter">
                  <span>正在查看 {selectedDiaryDate} 的记录</span>
                  <button className="cloud-button cloud-button--small cloud-button--ghost" data-testid="cloud-diary-date-clear" onClick={() => setSelectedDiaryDate(null)} type="button">
                    清除日期
                  </button>
                </div>
              ) : null}
              <div className="cloud-diary-actions" data-testid="cloud-diary-filters">
                <button
                  aria-pressed={diaryFilter === "all"}
                  className={diaryFilter === "all" ? "cloud-button cloud-button--small" : "cloud-button cloud-button--small cloud-button--ghost"}
                  data-testid="cloud-diary-filter-all"
                  onClick={() => setDiaryFilter("all")}
                  type="button"
                >
                  全部 ({diaryFilterCounts.all})
                </button>
                <button
                  aria-pressed={diaryFilter === "daily_diary"}
                  className={diaryFilter === "daily_diary" ? "cloud-button cloud-button--small" : "cloud-button cloud-button--small cloud-button--ghost"}
                  data-testid="cloud-diary-filter-daily"
                  onClick={() => setDiaryFilter("daily_diary")}
                  type="button"
                >
                  自动生成 ({diaryFilterCounts.dailyDiary})
                </button>
                <button
                  aria-pressed={diaryFilter === "owner_note"}
                  className={diaryFilter === "owner_note" ? "cloud-button cloud-button--small" : "cloud-button cloud-button--small cloud-button--ghost"}
                  data-testid="cloud-diary-filter-owner"
                  onClick={() => setDiaryFilter("owner_note")}
                  type="button"
                >
                  主人手记 ({diaryFilterCounts.ownerNote})
                </button>
              </div>
              {recentDailyDiaries.length > 0 ? (
                <ol>
                  {recentDailyDiaries.map((diary) => {
                    const diaryNoteId = getDiaryNoteId(diary);
                    const isOwnerNote = diary.type === "owner_note";
                    const isEditing = editingDiaryNoteId === diaryNoteId;

                    return (
                      <li data-testid="cloud-diary-entry" key={diaryNoteId}>
                        <strong>{diary.title}</strong>
                        <span>{new Date(diary.createdAt).toLocaleDateString("zh-CN")}</span>
                        {isEditing ? (
                          <div className="cloud-diary-edit">
                            <textarea
                              data-testid="cloud-diary-note-edit-body"
                              onChange={(event) => setEditingDiaryNoteBody(event.target.value)}
                              rows={3}
                              value={editingDiaryNoteBody}
                            />
                            <div className="cloud-diary-actions">
                              <button
                                className="cloud-button cloud-button--small"
                                data-testid="cloud-diary-note-save"
                                disabled={busyDiaryNoteId === diaryNoteId || !editingDiaryNoteBody.trim()}
                                onClick={() => void handleUpdateDiaryNote(diary)}
                                type="button"
                              >
                                {busyDiaryNoteId === diaryNoteId ? "更新中" : "保存修改"}
                              </button>
                              <button
                                className="cloud-button cloud-button--small cloud-button--ghost"
                                onClick={() => setEditingDiaryNoteId(null)}
                                type="button"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p>{diary.body}</p>
                        )}
                        {isOwnerNote && !isEditing ? (
                          <div className="cloud-diary-actions">
                            <button
                              className="cloud-button cloud-button--small"
                              data-testid="cloud-diary-note-edit"
                              disabled={!memberSession || busyDiaryNoteId === diaryNoteId}
                              onClick={() => handleStartDiaryNoteEdit(diary)}
                              type="button"
                            >
                              编辑
                            </button>
                            <button
                              className="cloud-button cloud-button--small cloud-button--ghost"
                              data-testid="cloud-diary-note-delete"
                              disabled={!memberSession || busyDiaryNoteId === diaryNoteId}
                              onClick={() => void handleDeleteDiaryNote(diary)}
                              type="button"
                            >
                              {busyDiaryNoteId === diaryNoteId ? "删除中" : "删除"}
                            </button>
                          </div>
                        ) : null}
                        {!isEditing ? (
                          <div className="cloud-diary-actions">
                            <Link
                              className="cloud-link-button cloud-link-button--compact"
                              data-testid={"cloud-diary-entry-open-" + diary.type}
                              href={getDiaryShareHref(activePetFromMember.petNo, diary)}
                            >
                              查看公开归档
                            </Link>
                            <button
                              className="cloud-button cloud-button--small cloud-button--ghost"
                              data-testid={"cloud-diary-entry-copy-" + diary.type}
                              onClick={() => void handleCopyDiaryLink(diary)}
                              type="button"
                            >
                              复制链接
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="cloud-muted">
                  {diaryFilter === "all"
                    ? "还没有照护日记，完成成长任务后会自动生成。"
                    : "当前筛选下暂无日记记录。"}
                </p>
              )}
              <form className="cloud-form cloud-form--compact" onSubmit={(event) => void handleDiaryNote(event)}>
                <label className="cloud-form__wide">
                  主人手记
                  <textarea
                    data-testid="cloud-diary-note-body"
                    maxLength={500}
                    onChange={(event) => setDiaryNoteBody(event.target.value)}
                    placeholder="记录今天的照顾细节或宠物变化"
                    rows={3}
                    value={diaryNoteBody}
                  />
                  <small>至少 5 个字，最多 500 字</small>
                </label>
                <button
                  className="cloud-button"
                  data-testid="cloud-diary-note-submit"
                  disabled={!memberSession || isSavingDiaryNote || !diaryNoteBody.trim()}
                  type="submit"
                >
                  {isSavingDiaryNote ? "保存中" : "保存手记"}
                </button>
              </form>
              <Link className="cloud-link-button cloud-link-button--compact" data-testid="cloud-open-full-diary" href={`/cloud-pets/${activePetFromMember.petNo}?archive=all`}>
                打开完整日记档案
              </Link>
            </section>
          </>
        ) : (
          <div className="cloud-empty" data-testid="cloud-first-pet-empty">
            <strong>还没有可运营的云养宠</strong>
            <span>同步会员或创建第一只宠物后，这里会成为每日照顾入口。</span>
            <a className="cloud-link-button cloud-link-button--compact" data-testid="cloud-empty-create-cta" href="#cloud-create-pet">创建第一只云养宠</a>
          </div>
        )}

        {growthTasks.length > 0 && activePetFromMember ? (
          <div className="cloud-task-list" data-testid="cloud-daily-care-tasks" id="cloud-daily-care">
            <div>
              <p className="section__kicker">成长任务</p>
              <h3>成长任务</h3>
            </div>
            {growthTasks.map((task) => {
              const isCompletedToday = completedTaskKeys.has(task.key);
              const taskCopy = getGrowthTaskCopy(task);

              return (
                <article className="cloud-task" key={task.key}>
                  <div>
                    <strong>{taskCopy.title}</strong>
                    <p>{taskCopy.description}</p>
                    <span>+{task.points} 积分 · 心情 {task.rewards.mood} · 精力 {task.rewards.energy} · 亲密 {task.rewards.intimacy}</span>
                    <small data-testid={`cloud-task-state-${task.key}`}>
                      {isCompletedToday ? "今日已完成" : "今日待完成"}
                    </small>
                  </div>
                  <button
                    className="cloud-button"
                    data-testid={`cloud-task-complete-${task.key}`}
                    disabled={!memberSession || busyTaskKey === task.key || isCompletedToday}
                    onClick={() => void handleCompleteTask(task)}
                    type="button"
                  >
                    {busyTaskKey === task.key ? "记录中" : isCompletedToday ? "已完成" : "完成"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}

        {taskNextActions.length > 0 ? (
          <div className="cloud-next-actions" data-testid="cloud-next-actions">
            {taskNextActions.map((action) => (
              <Link data-testid={`cloud-next-action-${action.key}`} href={action.href} key={action.key}>
                <strong>{action.title}</strong>
                <span>{action.description}</span>
                <em>{action.ctaLabel}</em>
              </Link>
            ))}
          </div>
        ) : null}

        <p className={error ? "cloud-status cloud-status--error" : "cloud-status"} data-testid="cloud-workspace-status">
          {error ?? status}
        </p>
      </section>

      <section className="cloud-card cloud-card--form" data-testid="cloud-create-section" id="cloud-create-pet">
        <p className="section__kicker">创建宠物</p>
        <h2>创建云养宠</h2>
        <p>保留原有创建入口，但创建成功后会自动绑定会员工作台，后续照顾、主页和社区都围绕这只宠物展开。</p>

        <form className="cloud-form" onSubmit={(event) => void handleCreate(event)}>
          <label>
            主人称呼
            <input
              data-testid="cloud-create-owner-name"
              disabled={isCreateOwnerLocked}
              maxLength={40}
              onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
              required
              value={form.ownerName}
            />
          </label>
          <label>
            手机号
            <input
              data-testid="cloud-create-owner-phone"
              disabled={isCreateOwnerLocked}
              inputMode="tel"
              maxLength={11}
              pattern="1[3-9][0-9]{9}"
              onChange={(event) => setForm((current) => ({ ...current, ownerPhone: event.target.value }))}
              required
              value={form.ownerPhone}
            />
          </label>
          <label>
            宠物昵称
            <input
              data-testid="cloud-create-pet-name"
              maxLength={24}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              value={form.name}
            />
          </label>
          <label>
            宠物类型
            <select
              data-testid="cloud-create-species"
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
              data-testid="cloud-create-personality"
              maxLength={80}
              onChange={(event) => setForm((current) => ({ ...current, personality: event.target.value }))}
              required
              rows={4}
              value={form.personality}
            />
          </label>
          <button className="cloud-button" data-testid="cloud-create-submit" disabled={isCreating || !memberSession || !form.name.trim() || !form.personality.trim() || (!isCreateOwnerLocked && !form.ownerName.trim())} type="submit">
            {isCreating ? "生成中" : "生成专属主页"}
          </button>
        </form>
      </section>

      <section className="cloud-card cloud-homepage" aria-live="polite">
        <p className="section__kicker">宠物主页</p>
        <h2>宠物专属主页</h2>
        {activePetFromMember ? (
          <>
            <PetProfile
              busyInteraction={busyInteraction}
              followerCount={followCountsByPet[activePetFromMember.petNo]}
              onCopyHomepageLink={handleCopyHomepageLink}
              onFollow={handleFollowPet}
              pet={activePetFromMember}
            />
            <HomepageBuilder
              key={activePetFromMember.petNo}
              pet={activePetFromMember}
              onSave={handleHomepageUpdate}
            />
          </>
        ) : (
          <div className="cloud-empty">
            <strong>还没有生成宠物主页</strong>
            <span>创建或同步云养宠后，这里会出现可分享的主页、成长状态和时间线。</span>
          </div>
        )}
      </section>

      <section className="cloud-card cloud-community" id="community">
        <p className="section__kicker">社区</p>
        <h2>宠物互动社区</h2>
        <div className="cloud-diary-actions" data-testid="cloud-community-feed-filters">
          <button
            aria-pressed={communityFeedFilter === "all"}
            className={communityFeedFilter === "all" ? "cloud-button cloud-button--small" : "cloud-button cloud-button--small cloud-button--ghost"}
            data-testid="cloud-feed-filter-all"
            onClick={() => setCommunityFeedFilter("all")}
            type="button"
          >
            全部 {posts.length} 条
          </button>
          <button
            aria-pressed={communityFeedFilter === "following"}
            className={communityFeedFilter === "following" ? "cloud-button cloud-button--small" : "cloud-button cloud-button--small cloud-button--ghost"}
            data-testid="cloud-feed-filter-following"
            disabled={!memberSession}
            onClick={() => setCommunityFeedFilter("following")}
            type="button"
          >
            已关注 {followedPosts.length} 条
          </button>
          <button
            aria-pressed={communityFeedFilter === "my_pet"}
            className={communityFeedFilter === "my_pet" ? "cloud-button cloud-button--small" : "cloud-button cloud-button--small cloud-button--ghost"}
            data-testid="cloud-feed-filter-my-pet"
            disabled={!activePetFromMember}
            onClick={() => setCommunityFeedFilter("my_pet")}
            type="button"
          >
            我的宠物 {activePetFromMember ? posts.filter((post) => post.petNo === activePetFromMember.petNo).length : 0} 条
          </button>
        </div>
        {isLoadingCommunity ? (
          <p
            className="cloud-muted"
            data-testid="cloud-community-loading"
            role="status"
          >
            正在加载社区动态。
          </p>
        ) : null}
        {communityError ? (
          <div className="cloud-empty" data-testid="cloud-community-error" role="alert">
            <strong>社区动态暂时未更新</strong>
            <span>{communityError}</span>
            <button
              className="cloud-button cloud-button--small cloud-button--ghost"
              data-testid="cloud-community-retry"
              onClick={() => void refreshCommunity(memberSession)}
              type="button"
            >
              重新加载
            </button>
          </div>
        ) : null}
        <form className="community-form" onSubmit={(event) => void handlePost(event)}>
          <textarea
            data-testid="cloud-community-body"
            disabled={!activePetFromMember}
            maxLength={280}
            onChange={(event) => setPostBody(event.target.value)}
            placeholder="记录今天的互动故事"
            required
            rows={4}
            value={postBody}
          />
          <small data-testid="cloud-community-limit">{postBody.length}/280 字</small>
          <button className="cloud-button" data-testid="cloud-community-submit" disabled={!activePetFromMember || !memberSession || isPosting || !postBody.trim()} type="submit">
            {isPosting ? "发布中" : "发布动态"}
          </button>
        </form>

        <div className="community-feed">
          {displayedCommunityPosts.length > 0 ? (
            displayedCommunityPosts.map((post) => (
              <article className="community-post" data-testid="cloud-community-post" id={`community-post-${post.postNo}`} key={post.postNo}>
                <strong>{post.petName}</strong>
                <small className="community-post__target-label">推荐商品</small>
                <p>{post.body}</p>
                <span data-testid="cloud-community-metrics">{post.authorName} · {post.likeCount} 点赞 · {post.commentCount} 评论</span>
                {post.commerceBridge ? (
                  <Link className="cloud-recommendation" href={post.commerceBridge.ctaHref}>
                    <strong>{post.commerceBridge.recommendedProduct
                      ? getProductTitleLabel(post.commerceBridge.recommendedProduct.title)
                      : post.commerceBridge.ctaLabel}</strong>
                    <span>{post.commerceBridge.reason}</span>
                  </Link>
                ) : null}
                <div className="admin-inline-actions">
                  <button className="cloud-button" data-testid="cloud-like-submit" disabled={!activePetFromMember || !memberSession || busyInteraction === `like-${post.postNo}`} onClick={() => void handleLike(post)} type="button">点赞</button>
                  <button className="cloud-button cloud-button--small cloud-button--ghost" data-testid="cloud-community-copy-link" onClick={() => void handleCopyCommunityPostLink(post)} type="button">复制讨论链接</button>
                  <select
                    className="cloud-report-select"
                    data-testid="cloud-report-reason"
                    disabled={!activePetFromMember || !memberSession || busyInteraction === `report-${post.postNo}`}
                    onChange={(event) =>
                      setReportReasonsByPost((current) => ({
                        ...current,
                        [post.postNo]: event.target.value
                      }))
                    }
                    value={reportReasonsByPost[post.postNo] ?? communityReportReasons[0]}
                  >
                    {communityReportReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <button className="cloud-button" data-testid="cloud-report-submit" disabled={!activePetFromMember || !memberSession || busyInteraction === `report-${post.postNo}`} onClick={() => void handleReport(post)} type="button">举报</button>
                </div>
                <div className="community-comments" data-testid="cloud-community-comments">
                  {(commentsByPost[post.postNo] ?? []).length === 0 ? (
                    <p className="community-comments__empty" data-testid="cloud-community-comments-empty">
                      暂无评论，来开启照顾话题吧。
                    </p>
                  ) : null}
                  {(commentsByPost[post.postNo] ?? []).slice(0, 3).map((comment) => (
                    <p data-testid="cloud-community-comment" key={comment.commentNo}>
                      <strong>{comment.authorName}</strong>
                      <span>{comment.body}</span>
                    </p>
                  ))}
                  <label>
                    评论内容
                    <textarea
                      data-testid="cloud-comment-body"
                      disabled={!activePetFromMember || !memberSession}
                      maxLength={280}
                      onChange={(event) =>
                        setCommentDrafts((current) => ({
                          ...current,
                          [post.postNo]: event.target.value
                        }))
                      }
                      rows={2}
                      value={commentDrafts[post.postNo] ?? ""}
                    />
                  </label>
                  <button
                    className="cloud-button cloud-button--small"
                    data-testid="cloud-comment-submit"
                    disabled={!activePetFromMember || !memberSession || busyInteraction === `comment-${post.postNo}` || !(commentDrafts[post.postNo] ?? "").trim()}
                    onClick={() => void handleComment(post)}
                    type="button"
                  >
                    {busyInteraction === `comment-${post.postNo}` ? "评论中" : "发送评论"}
                  </button>
                </div>
              </article>
            ))
          ) : !isLoadingCommunity ? (
            <p className="cloud-muted" data-testid="cloud-community-feed-empty">
              {communityFeedFilter === "following"
                ? "还没有关注宠物的动态。"
                : communityFeedFilter === "my_pet"
                  ? "这只宠物还没有动态。"
                  : "社区暂时没有公开动态。"}
            </p>
          ) : null}
        </div>
      </section>

      <aside
        className="cloud-card cloud-shop-bridge"
        data-pet-no={recommendationsForPetNo ?? ""}
        data-testid="cloud-recommendations-panel"
      >
        <p className="section__kicker">商城推荐</p>
        <h2>商城联动入口</h2>
        <p>商城先放到支线，当前只保留由宠物档案驱动的推荐入口，避免打断云养宠主线。</p>
        {isLoadingRecommendations ? (
          <p className="cloud-muted" data-testid="cloud-recommendations-loading" role="status">
            正在根据当前宠物更新推荐。
          </p>
        ) : recommendationError && activePetFromMember ? (
          <div data-testid="cloud-recommendations-error">
            <p className="cloud-status cloud-status--error">{recommendationError}</p>
            <button
              className="cloud-button cloud-button--small cloud-button--ghost"
              data-testid="cloud-recommendations-retry"
              onClick={() => void refreshRecommendations(activePetFromMember.petNo)}
              type="button"
            >
              重新加载
            </button>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="cloud-recommendations">
            {recommendations.map((product) => (
              <Link className="cloud-recommendation" href="/shop" key={product.slug}>
                <strong>{getProductTitleLabel(product.title)}</strong>
                <span>{product.reason}</span>
              </Link>
            ))}
          </div>
        ) : activePetFromMember && recommendationsForPetNo === activePetFromMember.petNo ? (
          <p className="cloud-muted" data-testid="cloud-recommendations-empty">
            当前没有匹配推荐，稍后再来看看。
          </p>
        ) : null}
        <Link className="cloud-link-button" href="/shop">去宠物商城选礼物</Link>
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

    const trimmedHeadline = form.headline?.trim();
    const trimmedOwnerStory = form.ownerStory?.trim();

    if (!trimmedHeadline || !trimmedOwnerStory) {
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        ...form,
        headline: trimmedHeadline,
        ownerStory: trimmedOwnerStory
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="homepage-builder" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <p className="section__kicker">主页配置</p>
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
          <option value="midnight">夜晚星窗</option>
        </select>
      </label>
      <label>
        主页标题
        <input
          data-testid="cloud-homepage-headline"
          maxLength={80}
          onChange={(event) => setForm((current) => ({ ...current, headline: event.target.value }))}
          required
          value={form.headline}
        />
      </label>
      <label className="homepage-builder__wide">
        主人故事
        <textarea
          data-testid="cloud-homepage-story"
          maxLength={240}
          onChange={(event) => setForm((current) => ({ ...current, ownerStory: event.target.value }))}
          required
          rows={3}
          value={form.ownerStory}
        />
      </label>
      <label className="homepage-builder__toggle">
        <input
          checked={form.showGrowthArchive}
          onChange={(event) => setForm((current) => ({ ...current, showGrowthArchive: event.target.checked }))}
          type="checkbox"
        />
        展示成长档案
      </label>
      <label className="homepage-builder__toggle">
        <input
          checked={form.showMallRecommendations}
          onChange={(event) => setForm((current) => ({ ...current, showMallRecommendations: event.target.checked }))}
          type="checkbox"
        />
        展示商城推荐
      </label>
      <button className="cloud-button" data-testid="cloud-homepage-save" disabled={isSaving || !form.headline?.trim() || !form.ownerStory?.trim()} type="submit">
        {isSaving ? "保存中" : "保存主页配置"}
      </button>
    </form>
  );
}

function PetProfile({
  busyInteraction,
  followerCount,
  onCopyHomepageLink,
  onFollow,
  pet
}: {
  busyInteraction: string | null;
  followerCount?: number;
  onCopyHomepageLink: (pet: CloudPetProfile) => Promise<void>;
  onFollow: (pet: CloudPetProfile) => Promise<void>;
  pet: CloudPetProfile;
}) {
  return (
    <div
      className="pet-homepage-card"
      data-pet-no={pet.petNo}
      data-testid="cloud-active-pet-profile"
    >
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
          <div className="pet-growth__bar" aria-label="成长进度">
            <span style={{ width: `${pet.growth.progressPercent}%` }} />
          </div>
          <p>
            成长值 {pet.growth.experiencePoints}/{pet.growth.nextLevelExperience} · 照护分 {pet.growth.careScore} · 今日任务 {pet.growth.todayCompletedTaskCount}
          </p>
        </div>
        <div className="pet-stats">
          <strong>心情 {pet.stats.mood}</strong>
          <strong>精力 {pet.stats.energy}</strong>
          <strong>亲密 {pet.stats.intimacy}</strong>
        </div>
        <div className="cloud-diary-actions">
          <Link href={getPetHomepageHref(pet.petNo)}>查看公开主页</Link>
          <button
            className="cloud-button cloud-button--small cloud-button--ghost"
            data-testid="cloud-homepage-copy-link"
            onClick={() => void onCopyHomepageLink(pet)}
            type="button"
          >
            复制主页链接
          </button>
        </div>
        {typeof followerCount === "number" ? (
          <p className="cloud-muted" data-testid="cloud-follow-signal">
            关注信号 / {followerCount} 位关注者
          </p>
        ) : null}
      </div>
      <button
        className="cloud-button"
        data-testid="cloud-follow-pet"
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


type CloudPetWorkspaceReminder = {
  key: string;
  label: string;
  description: string;
  href: string;
  ctaLabel: string;
};

function getCloudPetWorkspaceReminders(
  pet: CloudPetProfile | null,
  todayDiary: CloudPetProfile["timeline"][number] | null,
  hasTodayCommunityPost: boolean,
  notifications: MemberProfile["notifications"]
): CloudPetWorkspaceReminder[] {
  const reminders: CloudPetWorkspaceReminder[] = [];

  if (pet && !pet.growth.isCareCompleteToday) {
    reminders.push({
      key: "daily-care",
      label: "今日照顾",
      description: pet.name + " 还没完成今天的成长任务。",
      href: "#cloud-daily-care",
      ctaLabel: "去照顾"
    });
  }

  if (pet && !todayDiary) {
    reminders.push({
      key: "daily-diary",
      label: "补今日记",
      description: "完成成长任务后会自动生成今日日记。",
      href: "#cloud-daily-care",
      ctaLabel: "查看任务"
    });
  }

  if (pet && pet.growth.isCareCompleteToday && todayDiary) {
    reminders.push({
      key: "share-homepage",
      label: "分享主页",
      description: "今天的照护记录已经生成，可以分享宠物主页。",
      href: "/cloud-pets/" + pet.petNo,
      ctaLabel: "去分享"
    });

    if (hasTodayCommunityPost) {
      reminders.push({
        key: "view-community",
        label: "查看社区反馈",
        description: "今天已有社区动态，可以继续查看互动。",
        href: "#community",
        ctaLabel: "看社区"
      });
    } else {
      reminders.push({
        key: "share-community",
        label: "发布动态",
        description: "把今天的照护日记同步成一条社区动态。",
        href: "#community",
        ctaLabel: "去发布"
      });
    }
  }

  notifications.slice(0, 2).forEach((notification) => {
    reminders.push({
      key: "member-" + notification.id,
      label: notification.title,
      description: notification.body,
      href: notification.actionHref,
      ctaLabel: "查看"
    });
  });

  return reminders.slice(0, 3);
}


function getDiaryShareAnchor(diary: { id?: string; createdAt: string }) {
  return "diary-" + (diary.id ?? diary.createdAt).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function getDiaryShareHref(petNo: string, diary: { type: string; id?: string; createdAt: string }) {
  return `/cloud-pets/${petNo}?archive=${diary.type}#${getDiaryShareAnchor(diary)}`;
}

function getPetHomepageHref(petNo: string) {
  return `/cloud-pets/${petNo}`;
}

function getCommunityPostHref(postNo: string) {
  return `/cloud-pets#community-post-${postNo}`;
}

function isInvalidMemberSessionError(caught: unknown) {
  return caught instanceof Error && caught.message === "Invalid member session";
}

function createCommunityDraftFromDiary(
  pet: CloudPetProfile,
  diary: CloudPetProfile["timeline"][number]
) {
  return "今天照顾了" + pet.name + "：" + diary.title + " - " + diary.body;
}
