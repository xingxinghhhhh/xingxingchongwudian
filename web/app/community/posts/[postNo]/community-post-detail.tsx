"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getMemberProfile } from "../../../member/member-api";
import type { CommunityComment, CommunityPost } from "../../../cloud-pets/cloud-pets-api";
import {
  commentOnCommunityPost,
  likeCommunityPost,
  reportCommunityComment,
  reportCommunityPost,
  updateCommunityComment,
  updateCommunityPost,
  withdrawCommunityComment
} from "../../../cloud-pets/cloud-pets-api";
import { communityReportReasons } from "../../../cloud-pets/cloud-pet-copy";

const memberSessionKey = "kzt_member_session";
const memberPhoneKey = "kzt_member_phone";

function getCommentAnchor(commentNo: string) {
  return `comment-${encodeURIComponent(commentNo)}`;
}

interface CommunityPostDetailProps {
  post: CommunityPost;
  comments: CommunityComment[];
}

export function CommunityPostDetail({
  post: initialPost,
  comments: initialComments
}: CommunityPostDetailProps) {
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState(initialComments);
  const [commentBody, setCommentBody] = useState("");
  const [replyingToCommentNo, setReplyingToCommentNo] = useState<string | null>(null);
  const [memberSession, setMemberSession] = useState<string | null>(null);
  const [memberPhone, setMemberPhone] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(initialPost.body);
  const [editingCommentNo, setEditingCommentNo] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [reportReason, setReportReason] = useState(communityReportReasons[0]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusedCommentNo, setFocusedCommentNo] = useState<string | null>(null);

  useEffect(() => {
    const session = window.localStorage.getItem(memberSessionKey);
    const phone = window.localStorage.getItem(memberPhoneKey);
    setMemberSession(session);
    setMemberPhone(phone);

    if (!session || !phone) {
      return;
    }

    void getMemberProfile(phone, session)
      .then((profile) => {
        setCanEdit(profile.pets.some((pet) => pet.petNo === initialPost.petNo));
      })
      .catch((caught) => {
        if (caught instanceof Error && caught.message === "Invalid member session") {
          window.localStorage.removeItem(memberSessionKey);
          window.localStorage.removeItem(memberPhoneKey);
          setMemberSession(null);
          setMemberPhone(null);
        }
        setCanEdit(false);
      });
  }, [initialPost.petNo]);

  useEffect(() => {
    const focusCommentFromHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#comment-")) {
        return;
      }

      let commentNo: string;
      try {
        commentNo = decodeURIComponent(hash.slice("#comment-".length));
      } catch {
        return;
      }

      if (!comments.some((comment) => comment.commentNo === commentNo)) {
        return;
      }

      const element = document.getElementById(getCommentAnchor(commentNo));
      if (!element) {
        return;
      }

      element.scrollIntoView({ block: "center" });
      setFocusedCommentNo(commentNo);
      const timer = window.setTimeout(() => setFocusedCommentNo(null), 2200);
      return () => window.clearTimeout(timer);
    };

    const cleanupTimer = focusCommentFromHash();
    window.addEventListener("hashchange", focusCommentFromHash);
    return () => {
      window.removeEventListener("hashchange", focusCommentFromHash);
      cleanupTimer?.();
    };
  }, [comments]);

  async function handleLike() {
    if (!memberSession) {
      setError("请先同步会员后再点赞");
      return;
    }

    setBusyAction("like");
    setError(null);

    try {
      const result = await likeCommunityPost(post.postNo, {}, memberSession);
      setPost((current) => ({ ...current, likeCount: result.likeCount }));
      setStatus("已记录点赞");
    } catch (caught) {
      if (caught instanceof Error && caught.message === "Invalid member session") {
        window.localStorage.removeItem(memberSessionKey);
        window.localStorage.removeItem(memberPhoneKey);
        setMemberSession(null);
        setMemberPhone(null);
      }
      setError(caught instanceof Error ? caught.message : "点赞失败，请稍后重试");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReport() {
    if (!memberSession) {
      setError("请先同步会员后再举报");
      return;
    }

    setBusyAction("report");
    setError(null);

    try {
      const report = await reportCommunityPost(
        post.postNo,
        { reason: reportReason },
        memberSession
      );
      setStatus(
        report.created
          ? "举报已进入商家审核队列。"
          : "举报已更新到商家审核队列。"
      );
    } catch (caught) {
      if (caught instanceof Error && caught.message === "Invalid member session") {
        window.localStorage.removeItem(memberSessionKey);
        window.localStorage.removeItem(memberPhoneKey);
        setMemberSession(null);
        setMemberPhone(null);
        setCanEdit(false);
      }
      setError(caught instanceof Error ? caught.message : "举报失败，请稍后重试");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReportComment(commentNo: string) {
    if (!memberSession) {
      setError("请先同步会员后再举报");
      return;
    }

    setBusyAction(`report-comment-${commentNo}`);
    setError(null);

    try {
      const report = await reportCommunityComment(
        commentNo,
        { reason: reportReason },
        memberSession
      );
      setStatus(
        report.created
          ? "评论举报已进入商家审核队列。"
          : "评论举报已更新到商家审核队列。"
      );
    } catch (caught) {
      if (caught instanceof Error && caught.message === "Invalid member session") {
        window.localStorage.removeItem(memberSessionKey);
        window.localStorage.removeItem(memberPhoneKey);
        setMemberSession(null);
        setMemberPhone(null);
        setCanEdit(false);
      }
      setError(caught instanceof Error ? caught.message : "评论举报失败，请稍后重试");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!memberSession) {
      setError("请先同步会员后再评论");
      return;
    }

    const body = commentBody.trim();

    if (!body) {
      setError("请输入评论内容");
      return;
    }

    setBusyAction("comment");
    setError(null);
    const parentCommentNo = replyingToCommentNo ?? undefined;

    try {
      const comment = await commentOnCommunityPost(
        post.postNo,
        { body, parentCommentNo },
        memberSession
      );
      setComments((current) => [comment, ...current]);
      setPost((current) => ({
        ...current,
        commentCount: current.commentCount + 1
      }));
      setCommentBody("");
      setReplyingToCommentNo(null);
      setStatus(parentCommentNo ? "回复已发布" : "评论已发布");
    } catch (caught) {
      if (caught instanceof Error && caught.message === "Invalid member session") {
        window.localStorage.removeItem(memberSessionKey);
        window.localStorage.removeItem(memberPhoneKey);
        setMemberSession(null);
        setMemberPhone(null);
      }
      setError(caught instanceof Error ? caught.message : "评论失败，请稍后重试");
    } finally {
      setBusyAction(null);
    }
  }

  function handleStartEdit() {
    setEditBody(post.body);
    setIsEditing(true);
    setError(null);
  }

  function handleCancelEdit() {
    setEditBody(post.body);
    setIsEditing(false);
    setError(null);
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!memberSession || !canEdit) {
      setError("只能编辑自己发布的帖子");
      return;
    }

    const body = editBody.trim();

    if (!body) {
      setError("请输入帖子内容");
      return;
    }

    setBusyAction("edit");
    setError(null);

    try {
      const updatedPost = await updateCommunityPost(
        post.postNo,
        { body },
        memberSession
      );
      setPost(updatedPost);
      setEditBody(updatedPost.body);
      setIsEditing(false);
      setStatus("帖子已更新");
    } catch (caught) {
      if (caught instanceof Error && caught.message === "Invalid member session") {
        window.localStorage.removeItem(memberSessionKey);
        window.localStorage.removeItem(memberPhoneKey);
        setMemberSession(null);
        setMemberPhone(null);
        setCanEdit(false);
      }
      setError(caught instanceof Error ? caught.message : "编辑帖子失败，请稍后重试");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleWithdrawComment(comment: CommunityComment) {
    if (!memberSession) {
      setError("请先同步会员后再撤回评论");
      return;
    }

    if (!memberPhone || comment.memberPhone !== memberPhone) {
      setError("只能撤回自己发布的评论");
      return;
    }

    if (!window.confirm("确认撤回这条评论吗？")) {
      return;
    }

    setBusyAction(`withdraw-comment-${comment.commentNo}`);
    setError(null);

    try {
      await withdrawCommunityComment(comment.commentNo, memberSession);
      setComments((current) =>
        current.filter((item) => item.commentNo !== comment.commentNo)
      );
      if (replyingToCommentNo === comment.commentNo) {
        setReplyingToCommentNo(null);
      }
      setPost((current) => ({
        ...current,
        commentCount: Math.max(0, current.commentCount - 1)
      }));
      setStatus("评论已撤回");
    } catch (caught) {
      if (caught instanceof Error && caught.message === "Invalid member session") {
        window.localStorage.removeItem(memberSessionKey);
        window.localStorage.removeItem(memberPhoneKey);
        setMemberSession(null);
        setMemberPhone(null);
      }
      setError(caught instanceof Error ? caught.message : "撤回评论失败，请稍后重试");
    } finally {
      setBusyAction(null);
    }
  }

  function handleStartEditComment(comment: CommunityComment) {
    setEditingCommentNo(comment.commentNo);
    setEditCommentBody(comment.body);
    setError(null);
  }

  function handleCancelEditComment() {
    setEditingCommentNo(null);
    setEditCommentBody("");
    setError(null);
  }

  async function handleEditComment(
    event: FormEvent<HTMLFormElement>,
    comment: CommunityComment
  ) {
    event.preventDefault();

    if (!memberSession || !memberPhone || comment.memberPhone !== memberPhone) {
      setError("只能编辑自己发布的评论");
      return;
    }

    const body = editCommentBody.trim();

    if (!body) {
      setError("请输入评论内容");
      return;
    }

    setBusyAction(`edit-comment-${comment.commentNo}`);
    setError(null);

    try {
      const updatedComment = await updateCommunityComment(
        comment.commentNo,
        { body },
        memberSession
      );
      setComments((current) =>
        current.map((item) =>
          item.commentNo === comment.commentNo ? updatedComment : item
        )
      );
      setEditingCommentNo(null);
      setEditCommentBody("");
      setStatus("评论已更新");
    } catch (caught) {
      if (caught instanceof Error && caught.message === "Invalid member session") {
        window.localStorage.removeItem(memberSessionKey);
        window.localStorage.removeItem(memberPhoneKey);
        setMemberSession(null);
        setMemberPhone(null);
      }
      setError(caught instanceof Error ? caught.message : "编辑评论失败，请稍后重试");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopyLink() {
    setError(null);

    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("讨论链接已复制");
    } catch {
      setStatus(`讨论链接：${window.location.href}`);
    }
  }

  async function handleCopyCommentLink(commentNo: string) {
    const url = `${window.location.origin}${window.location.pathname}#${getCommentAnchor(commentNo)}`;
    setError(null);

    try {
      await navigator.clipboard.writeText(url);
      setStatus("评论链接已复制");
    } catch {
      setStatus(`评论链接：${url}`);
    }
  }

  const orderedComments = comments
    .filter((comment) => !comment.parentCommentNo)
    .flatMap((comment) => [
      comment,
      ...comments
        .filter((reply) => reply.parentCommentNo === comment.commentNo)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    ]);
  const replyingToComment = replyingToCommentNo
    ? comments.find((comment) => comment.commentNo === replyingToCommentNo)
    : undefined;

  return (
    <article className="community-post community-post-detail" data-testid="community-post-detail">
      <div className="community-post-detail__header">
        <div>
          <p className="section__kicker">社区讨论</p>
          <h1>{post.petName} 的动态</h1>
          <p className="cloud-muted">{post.authorName} · {new Date(post.createdAt).toLocaleString("zh-CN")}</p>
        </div>
        <button
          className="cloud-button cloud-button--small cloud-button--ghost"
          data-testid="community-post-detail-copy-link"
          onClick={() => void handleCopyLink()}
          type="button"
        >
          复制链接
        </button>
        {canEdit && !isEditing ? (
          <button
            className="cloud-button cloud-button--small cloud-button--ghost"
            data-testid="community-post-detail-edit"
            disabled={busyAction !== null}
            onClick={handleStartEdit}
            type="button"
          >
            编辑帖子
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <form onSubmit={(event) => void handleEdit(event)}>
          <textarea
            className="community-post-detail__body"
            data-testid="community-post-detail-edit-body"
            maxLength={280}
            onChange={(event) => setEditBody(event.target.value)}
            rows={5}
            value={editBody}
          />
          <div className="admin-inline-actions">
            <button
              className="cloud-button cloud-button--small"
              data-testid="community-post-detail-edit-save"
              disabled={busyAction !== null || !editBody.trim()}
              type="submit"
            >
              {busyAction === "edit" ? "保存中…" : "保存修改"}
            </button>
            <button
              className="cloud-button cloud-button--small cloud-button--ghost"
              data-testid="community-post-detail-edit-cancel"
              disabled={busyAction !== null}
              onClick={handleCancelEdit}
              type="button"
            >
              取消
            </button>
          </div>
        </form>
      ) : (
        <p className="community-post-detail__body" data-testid="community-post-detail-body">
          {post.body}
        </p>
      )}
      <p className="cloud-muted" data-testid="community-post-detail-metrics">
        {post.likeCount} 次点赞 · {post.commentCount} 条评论
      </p>

      <div className="admin-inline-actions">
        <button
          className="cloud-button cloud-button--small"
          data-testid="community-post-detail-like"
          disabled={!memberSession || busyAction !== null}
          onClick={() => void handleLike()}
          type="button"
        >
          {busyAction === "like" ? "处理中…" : "点赞"}
        </button>
        <select
          className="cloud-report-select"
          data-testid="community-post-detail-report-reason"
          disabled={!memberSession || busyAction !== null}
          onChange={(event) => setReportReason(event.target.value)}
          value={reportReason}
        >
          {communityReportReasons.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>
        <button
          className="cloud-button cloud-button--small cloud-button--ghost"
          data-testid="community-post-detail-report-submit"
          disabled={!memberSession || busyAction !== null}
          onClick={() => void handleReport()}
          type="button"
        >
          {busyAction === "report" ? "处理中…" : "举报"}
        </button>
        <Link
          className="cloud-button cloud-button--small cloud-button--ghost"
          data-testid="community-post-detail-pet-link"
          href={`/cloud-pets/${encodeURIComponent(post.petNo)}#pet-public-community`}
        >
          查看宠物主页
        </Link>
        <Link
          className="cloud-button cloud-button--small cloud-button--ghost"
          data-testid="community-post-detail-workspace-link"
          href={`/cloud-pets#community-post-${encodeURIComponent(post.postNo)}`}
        >
          返回社区工作台
        </Link>
      </div>

      {error ? <p className="cloud-error" data-testid="community-post-detail-error" role="alert">{error}</p> : null}
      {status ? <p className="cloud-status" data-testid="community-post-detail-status" role="status">{status}</p> : null}

      <section className="community-comments" data-testid="community-post-detail-comments">
        <h2>评论</h2>
        {orderedComments.length > 0 ? (
          orderedComments.map((comment) => (
            <article
              className={
                [
                  "community-post-detail-comment",
                  comment.parentCommentNo ? "community-post-detail-comment--reply" : "",
                  focusedCommentNo === comment.commentNo
                    ? "community-post-detail-comment--focused"
                    : ""
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              data-comment-no={comment.commentNo}
              data-parent-comment-no={comment.parentCommentNo}
              data-testid="community-post-detail-comment"
              id={getCommentAnchor(comment.commentNo)}
              key={comment.commentNo}
            >
              <strong>{comment.authorName}</strong>
              {editingCommentNo === comment.commentNo ? (
                <form onSubmit={(event) => void handleEditComment(event, comment)}>
                  <textarea
                    data-testid="community-post-detail-comment-edit-body"
                    maxLength={280}
                    onChange={(event) => setEditCommentBody(event.target.value)}
                    rows={3}
                    value={editCommentBody}
                  />
                  <div className="admin-inline-actions">
                    <button
                      className="cloud-button cloud-button--small"
                      data-testid="community-post-detail-comment-edit-save"
                      disabled={busyAction !== null || !editCommentBody.trim()}
                      type="submit"
                    >
                      {busyAction === `edit-comment-${comment.commentNo}`
                        ? "保存中…"
                        : "保存评论"}
                    </button>
                    <button
                      className="cloud-button cloud-button--small cloud-button--ghost"
                      data-testid="community-post-detail-comment-edit-cancel"
                      disabled={busyAction !== null}
                      onClick={handleCancelEditComment}
                      type="button"
                    >
                      取消
                    </button>
                  </div>
                </form>
              ) : (
                <span>{comment.body}</span>
              )}
              <div className="admin-inline-actions">
                <button
                  className="cloud-button cloud-button--small cloud-button--ghost"
                  data-testid="community-post-detail-comment-copy-link"
                  onClick={() => void handleCopyCommentLink(comment.commentNo)}
                  type="button"
                >
                  复制评论链接
                </button>
                {!comment.parentCommentNo ? (
                  <button
                    className="cloud-button cloud-button--small cloud-button--ghost"
                    data-testid="community-post-detail-comment-reply"
                    disabled={!memberSession || busyAction !== null}
                    onClick={() => {
                      setReplyingToCommentNo(comment.commentNo);
                      setError(null);
                    }}
                    type="button"
                  >
                    回复
                  </button>
                ) : null}
                <select
                  className="cloud-report-select"
                  data-testid="community-post-detail-comment-report-reason"
                  disabled={!memberSession || busyAction !== null}
                  onChange={(event) => setReportReason(event.target.value)}
                  value={reportReason}
                >
                  {communityReportReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <button
                  className="cloud-button cloud-button--small cloud-button--ghost"
                  data-testid="community-post-detail-comment-report-submit"
                  disabled={!memberSession || busyAction !== null}
                  onClick={() => void handleReportComment(comment.commentNo)}
                  type="button"
                >
                  {busyAction === `report-comment-${comment.commentNo}`
                    ? "处理中…"
                    : "举报评论"}
                </button>
              </div>
              {memberSession && memberPhone && comment.memberPhone === memberPhone ? (
                <div className="admin-inline-actions">
                  {editingCommentNo !== comment.commentNo ? (
                    <button
                      className="cloud-button cloud-button--small cloud-button--ghost"
                      data-testid="community-post-detail-comment-edit"
                      disabled={busyAction !== null}
                      onClick={() => handleStartEditComment(comment)}
                      type="button"
                    >
                      编辑评论
                    </button>
                  ) : null}
                <button
                  className="cloud-button cloud-button--small cloud-button--ghost"
                  data-testid="community-post-detail-comment-withdraw"
                  disabled={busyAction !== null}
                  onClick={() => void handleWithdrawComment(comment)}
                  type="button"
                >
                  {busyAction === `withdraw-comment-${comment.commentNo}`
                    ? "撤回中…"
                    : "撤回评论"}
                </button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="community-comments__empty" data-testid="community-post-detail-comments-empty">
            暂无评论，来开启讨论吧。
          </p>
        )}

        {replyingToComment ? (
          <div data-testid="community-post-detail-reply-context">
            <span>正在回复 {replyingToComment.authorName}</span>
            <button
              className="cloud-button cloud-button--small cloud-button--ghost"
              data-testid="community-post-detail-reply-cancel"
              disabled={busyAction !== null}
              onClick={() => setReplyingToCommentNo(null)}
              type="button"
            >
              取消回复
            </button>
          </div>
        ) : null}
        <form onSubmit={(event) => void handleComment(event)}>
          <label>
            评论内容
            <textarea
              data-testid="community-post-detail-comment-body"
              disabled={!memberSession || busyAction !== null}
              maxLength={280}
              onChange={(event) => setCommentBody(event.target.value)}
              rows={3}
              value={commentBody}
            />
          </label>
          <button
            className="cloud-button cloud-button--small"
            data-testid="community-post-detail-comment-submit"
            disabled={!memberSession || busyAction !== null || !commentBody.trim()}
            type="submit"
          >
            {busyAction === "comment" ? "评论中…" : "发表评论"}
          </button>
        </form>
        {!memberSession ? <p className="cloud-muted">同步会员后可点赞和评论。</p> : null}
      </section>
    </article>
  );
}
