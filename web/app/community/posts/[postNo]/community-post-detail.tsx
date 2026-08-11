"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { CommunityComment, CommunityPost } from "../../../cloud-pets/cloud-pets-api";
import {
  commentOnCommunityPost,
  likeCommunityPost
} from "../../../cloud-pets/cloud-pets-api";

const memberSessionKey = "kzt_member_session";

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
  const [memberSession, setMemberSession] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"like" | "comment" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMemberSession(window.localStorage.getItem(memberSessionKey));
  }, []);

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
        setMemberSession(null);
      }
      setError(caught instanceof Error ? caught.message : "点赞失败，请稍后重试");
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

    try {
      const comment = await commentOnCommunityPost(
        post.postNo,
        { body },
        memberSession
      );
      setComments((current) => [comment, ...current]);
      setPost((current) => ({
        ...current,
        commentCount: current.commentCount + 1
      }));
      setCommentBody("");
      setStatus("评论已发布");
    } catch (caught) {
      if (caught instanceof Error && caught.message === "Invalid member session") {
        window.localStorage.removeItem(memberSessionKey);
        setMemberSession(null);
      }
      setError(caught instanceof Error ? caught.message : "评论失败，请稍后重试");
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
      </div>

      <p className="community-post-detail__body" data-testid="community-post-detail-body">
        {post.body}
      </p>
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
        {comments.length > 0 ? (
          comments.map((comment) => (
            <p data-testid="community-post-detail-comment" key={comment.commentNo}>
              <strong>{comment.authorName}</strong>
              <span>{comment.body}</span>
            </p>
          ))
        ) : (
          <p className="community-comments__empty" data-testid="community-post-detail-comments-empty">
            暂无评论，来开启讨论吧。
          </p>
        )}

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
