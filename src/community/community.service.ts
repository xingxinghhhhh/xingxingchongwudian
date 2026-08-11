import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CloudPetsService } from "../cloud-pets/cloud-pets.service";
import { PrismaService } from "../database/prisma.service";
import { CreateCommunityCommentDto } from "./dto/create-community-comment.dto";
import { CreateCommunityFollowDto } from "./dto/create-community-follow.dto";
import { CreateCommunityLikeDto } from "./dto/create-community-like.dto";
import { CreateCommunityPostDto } from "./dto/create-community-post.dto";
import { CreateCommunityReportDto } from "./dto/create-community-report.dto";

export type CommunityPostStatus = "visible" | "hidden";
export type CommunityReportStatus = "pending_review" | "reviewed" | "dismissed";

export interface CommunityPostResponse {
  postNo: string;
  petNo: string;
  petName: string;
  authorName: string;
  body: string;
  status: CommunityPostStatus;
  likeCount: number;
  commentCount: number;
  reportCount: number;
  authorDeletedAt?: string;
  createdAt: string;
  commerceBridge?: {
    ctaHref: string;
    ctaLabel: string;
    reason: string;
    recommendedProduct?: {
      slug: string;
      title: string;
      petType: "cat" | "dog" | "both";
      priceCents: number;
    };
  };
}

export interface CommunityCommentResponse {
  commentNo: string;
  postNo: string;
  memberPhone?: string;
  authorName: string;
  body: string;
  status: CommunityPostStatus;
  authorDeletedAt?: string;
  createdAt: string;
}

export interface CommunityReportResponse {
  reportNo: string;
  postNo: string;
  memberPhone?: string;
  reporterName: string;
  reason: string;
  status: CommunityReportStatus;
  note?: string;
  createdAt: string;
  resolvedAt?: string;
  created?: boolean;
}

export interface CommunityReportFilters {
  status?: CommunityReportStatus;
  postNo?: string;
  memberPhone?: string;
}

export interface CommunityEngagementSummary {
  likedPostCount: number;
  commentCount: number;
  followingPetCount: number;
  reportCount: number;
}

interface CommunityPostRecord extends CommunityPostResponse {
  createdAt: string;
}
type AuthenticatedCommunityPostInput = CreateCommunityPostDto & {
  authorName: string;
  memberPhone: string;
};

type AuthenticatedCommunityLikeInput = CreateCommunityLikeDto & {
  memberPhone: string;
};

type AuthenticatedCommunityCommentInput = CreateCommunityCommentDto & {
  memberPhone: string;
  authorName: string;
};

type AuthenticatedCommunityFollowInput = CreateCommunityFollowDto & {
  followerPhone: string;
  followerName: string;
};

type AuthenticatedCommunityReportInput = CreateCommunityReportDto & {
  memberPhone: string;
  reporterName: string;
};

@Injectable()
export class CommunityService {
  private readonly posts: CommunityPostRecord[] = [];
  private readonly comments: CommunityCommentResponse[] = [];
  private readonly likes = new Map<string, { postNo: string; memberPhone: string; authorName?: string }>();
  private readonly follows = new Map<string, { petNo: string; followerPhone: string; followerName: string }>();
  private readonly reports: CommunityReportResponse[] = [];
  private sequence = 0;
  private commentSequence = 0;
  private reportSequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cloudPetsService: CloudPetsService
  ) {}

  async createPost(dto: AuthenticatedCommunityPostInput): Promise<CommunityPostResponse> {
    const pet = await this.cloudPetsService.getPetRecord(dto.petNo);
    const postNo = this.createPostNo();

    if (!this.isDatabaseConfigured()) {
      const post: CommunityPostRecord = {
        postNo,
        petNo: pet.petNo,
        petName: pet.name,
        authorName: dto.authorName,
        body: dto.body,
        status: "visible",
        likeCount: 0,
        commentCount: 0,
        reportCount: 0,
        authorDeletedAt: undefined,
        createdAt: new Date().toISOString()
      };
      this.posts.unshift(post);
      return this.withCommerceBridge(post);
    }

    const dbPet = await this.prisma.virtualPet.findUniqueOrThrow({
      where: { petNo: pet.petNo }
    });
    const post = await this.prisma.communityPost.create({
      data: {
        postNo,
        petId: dbPet.id,
        petNo: pet.petNo,
        petName: pet.name,
        authorName: dto.authorName,
        body: dto.body
      }
    });

    return this.withCommerceBridge({
      postNo: post.postNo,
      petNo: post.petNo,
      petName: post.petName,
      authorName: post.authorName,
      body: post.body,
      status: post.status,
      likeCount: 0,
      commentCount: 0,
      reportCount: 0,
      createdAt: post.createdAt.toISOString()
    });
  }

  async listPosts(): Promise<CommunityPostResponse[]> {
    if (!this.isDatabaseConfigured()) {
      return this.withCommerceBridges(
        this.posts.filter(
          (post) => post.status === "visible" && !post.authorDeletedAt
        )
      );
    }

    const posts = await this.prisma.communityPost.findMany({
      where: { status: "visible", authorDeletedAt: null },
      include: this.visiblePostInclude(),
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return this.withCommerceBridges(posts.map((post) => this.toResponse(post)));
  }

  async listAdminPosts(): Promise<CommunityPostResponse[]> {
    if (!this.isDatabaseConfigured()) {
      return this.withCommerceBridges(this.posts);
    }

    const posts = await this.prisma.communityPost.findMany({
      include: this.postInclude(),
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return this.withCommerceBridges(posts.map((post) => this.toResponse(post)));
  }

  async listFollowedPostsByMemberPhone(
    memberPhone: string
  ): Promise<CommunityPostResponse[]> {
    if (!this.isDatabaseConfigured()) {
      const followedPetNos = new Set(
        Array.from(this.follows.values())
          .filter((follow) => follow.followerPhone === memberPhone)
          .map((follow) => follow.petNo)
      );

      return this.withCommerceBridges(
        this.posts.filter(
          (post) =>
            post.status === "visible" &&
            !post.authorDeletedAt &&
            followedPetNos.has(post.petNo)
        )
      );
    }

    const follows = await this.prisma.communityFollow.findMany({
      where: { followerPhone: memberPhone },
      select: { petNo: true }
    });
    const followedPetNos = follows.map((follow) => follow.petNo);

    if (followedPetNos.length === 0) {
      return [];
    }

    const posts = await this.prisma.communityPost.findMany({
      where: {
        status: "visible",
        authorDeletedAt: null,
        petNo: { in: followedPetNos }
      },
      include: this.visiblePostInclude(),
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return this.withCommerceBridges(posts.map((post) => this.toResponse(post)));
  }

  async withdrawPost(postNo: string, memberPhone: string) {
    if (!this.isDatabaseConfigured()) {
      const post = this.posts.find((item) => item.postNo === postNo);

      if (!post) {
        throw new NotFoundException("Community post not found");
      }

      const pet = await this.cloudPetsService.getPetRecord(post.petNo);

      if (pet.ownerPhone !== memberPhone) {
        throw new ForbiddenException("Only the post author can withdraw this post");
      }

      post.authorDeletedAt ??= new Date().toISOString();
      return this.withCommerceBridge(post);
    }

    const post = await this.prisma.communityPost.findUnique({
      where: { postNo }
    });

    if (!post) {
      throw new NotFoundException("Community post not found");
    }

    const pet = await this.cloudPetsService.getPetRecord(post.petNo);

    if (pet.ownerPhone !== memberPhone) {
      throw new ForbiddenException("Only the post author can withdraw this post");
    }

    const withdrawnPost = post.authorDeletedAt
      ? post
      : await this.prisma.communityPost.update({
          where: { postNo },
          data: { authorDeletedAt: new Date() },
          include: this.postInclude()
        });

    return this.withCommerceBridge(this.toResponse(withdrawnPost));
  }

  async updatePost(postNo: string, memberPhone: string, body: string) {
    if (!this.isDatabaseConfigured()) {
      const post = this.posts.find((item) => item.postNo === postNo);

      if (!post) {
        throw new NotFoundException("Community post not found");
      }

      const pet = await this.cloudPetsService.getPetRecord(post.petNo);

      if (pet.ownerPhone !== memberPhone) {
        throw new ForbiddenException("Only the post author can edit this post");
      }

      if (post.status !== "visible" || post.authorDeletedAt) {
        throw new NotFoundException("Community post not found");
      }

      post.body = body;
      return this.withCommerceBridge(post);
    }

    const post = await this.prisma.communityPost.findUnique({
      where: { postNo }
    });

    if (!post) {
      throw new NotFoundException("Community post not found");
    }

    const pet = await this.cloudPetsService.getPetRecord(post.petNo);

    if (pet.ownerPhone !== memberPhone) {
      throw new ForbiddenException("Only the post author can edit this post");
    }

    if (post.status !== "visible" || post.authorDeletedAt) {
      throw new NotFoundException("Community post not found");
    }

    const updatedPost = await this.prisma.communityPost.update({
      where: { postNo },
      data: { body },
      include: this.visiblePostInclude()
    });

    return this.withCommerceBridge(this.toResponse(updatedPost));
  }

  async getPost(postNo: string): Promise<CommunityPostResponse> {
    if (!this.isDatabaseConfigured()) {
      const post = this.posts.find(
        (item) =>
          item.postNo === postNo &&
          item.status === "visible" &&
          !item.authorDeletedAt
      );

      if (!post) {
        throw new NotFoundException("Community post not found");
      }

      return this.withCommerceBridge(post);
    }

    const post = await this.prisma.communityPost.findFirst({
      where: { postNo, status: "visible", authorDeletedAt: null },
      include: this.visiblePostInclude()
    });

    if (!post) {
      throw new NotFoundException("Community post not found");
    }

    return this.withCommerceBridge(this.toResponse(post));
  }

  async likePost(postNo: string, dto: AuthenticatedCommunityLikeInput) {
    await this.ensurePost(postNo);

    if (!this.isDatabaseConfigured()) {
      const key = `${postNo}:${dto.memberPhone}`;
      this.likes.set(key, {
        postNo,
        memberPhone: dto.memberPhone,
        authorName: dto.authorName
      });
      this.refreshMemoryPostMetrics(postNo);

      return {
        postNo,
        liked: true,
        likeCount: this.countMemoryLikes(postNo)
      };
    }

    const post = await this.prisma.communityPost.findUniqueOrThrow({
      where: { postNo },
      select: { id: true }
    });

    await this.prisma.communityLike.upsert({
      where: {
        postNo_memberPhone: {
          postNo,
          memberPhone: dto.memberPhone
        }
      },
      update: { authorName: dto.authorName },
      create: {
        postId: post.id,
        postNo,
        memberPhone: dto.memberPhone,
        authorName: dto.authorName
      }
    });

    return {
      postNo,
      liked: true,
      likeCount: await this.prisma.communityLike.count({ where: { postNo } })
    };
  }

  async commentOnPost(
    postNo: string,
    dto: AuthenticatedCommunityCommentInput
  ): Promise<CommunityCommentResponse> {
    await this.ensurePost(postNo);
    const commentNo = this.createCommentNo();

    if (!this.isDatabaseConfigured()) {
      const comment = {
        commentNo,
        postNo,
        memberPhone: dto.memberPhone,
        authorName: dto.authorName,
        body: dto.body,
        status: "visible",
        authorDeletedAt: undefined,
        createdAt: new Date().toISOString()
      } satisfies CommunityCommentResponse;
      this.comments.unshift(comment);
      this.refreshMemoryPostMetrics(postNo);
      return comment;
    }

    const post = await this.prisma.communityPost.findUniqueOrThrow({
      where: { postNo },
      select: { id: true }
    });
    const comment = await this.prisma.communityComment.create({
      data: {
        commentNo,
        postId: post.id,
        postNo,
        memberPhone: dto.memberPhone,
        authorName: dto.authorName,
        body: dto.body
      }
    });

    return this.toCommentResponse(comment);
  }

  async withdrawComment(commentNo: string, memberPhone: string) {
    if (!this.isDatabaseConfigured()) {
      const comment = this.comments.find((item) => item.commentNo === commentNo);

      if (!comment) {
        throw new NotFoundException("Community comment not found");
      }

      if (comment.memberPhone !== memberPhone) {
        throw new ForbiddenException(
          "Only the comment author can withdraw this comment"
        );
      }

      comment.authorDeletedAt ??= new Date().toISOString();
      this.refreshMemoryPostMetrics(comment.postNo);
      return comment;
    }

    const comment = await this.prisma.communityComment.findUnique({
      where: { commentNo }
    });

    if (!comment) {
      throw new NotFoundException("Community comment not found");
    }

    if (comment.memberPhone !== memberPhone) {
      throw new ForbiddenException(
        "Only the comment author can withdraw this comment"
      );
    }

    const withdrawnComment = comment.authorDeletedAt
      ? comment
      : await this.prisma.communityComment.update({
          where: { commentNo },
          data: { authorDeletedAt: new Date() }
        });

    return this.toCommentResponse(withdrawnComment);
  }

  async updateComment(commentNo: string, memberPhone: string, body: string) {
    if (!this.isDatabaseConfigured()) {
      const comment = this.comments.find((item) => item.commentNo === commentNo);

      if (!comment) {
        throw new NotFoundException("Community comment not found");
      }

      if (comment.memberPhone !== memberPhone) {
        throw new ForbiddenException("Only the comment author can edit this comment");
      }

      const post = this.posts.find((item) => item.postNo === comment.postNo);

      if (
        !post ||
        post.status !== "visible" ||
        post.authorDeletedAt ||
        comment.status !== "visible" ||
        comment.authorDeletedAt
      ) {
        throw new NotFoundException("Community comment not found");
      }

      comment.body = body;
      return comment;
    }

    const comment = await this.prisma.communityComment.findUnique({
      where: { commentNo }
    });

    if (!comment) {
      throw new NotFoundException("Community comment not found");
    }

    if (comment.memberPhone !== memberPhone) {
      throw new ForbiddenException("Only the comment author can edit this comment");
    }

    const post = await this.prisma.communityPost.findUnique({
      where: { postNo: comment.postNo },
      select: { status: true, authorDeletedAt: true }
    });

    if (
      !post ||
      post.status !== "visible" ||
      post.authorDeletedAt ||
      comment.status !== "visible" ||
      comment.authorDeletedAt
    ) {
      throw new NotFoundException("Community comment not found");
    }

    const updatedComment = await this.prisma.communityComment.update({
      where: { commentNo },
      data: { body }
    });

    return this.toCommentResponse(updatedComment);
  }


  async listComments(postNo: string): Promise<CommunityCommentResponse[]> {
    await this.ensurePost(postNo);

    if (!this.isDatabaseConfigured()) {
      return this.comments
        .filter(
          (comment) =>
            comment.postNo === postNo &&
            comment.status === "visible" &&
            !comment.authorDeletedAt
        )
        .slice(0, 20);
    }

    const comments = await this.prisma.communityComment.findMany({
      where: { postNo, status: "visible", authorDeletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return comments.map((comment) => this.toCommentResponse(comment));
  }

  async followPet(petNo: string, dto: AuthenticatedCommunityFollowInput) {
    await this.cloudPetsService.getPetRecord(petNo);

    if (!this.isDatabaseConfigured()) {
      const key = `${petNo}:${dto.followerPhone}`;
      const created = !this.follows.has(key);
      this.follows.set(key, {
        petNo,
        followerPhone: dto.followerPhone,
        followerName: dto.followerName
      });

      return {
        petNo,
        followerPhone: dto.followerPhone,
        following: true,
        created,
        followerCount: this.countMemoryFollows(petNo)
      };
    }

    const pet = await this.prisma.virtualPet.findUniqueOrThrow({
      where: { petNo },
      select: { id: true }
    });
    const existingFollow = await this.prisma.communityFollow.findUnique({
      where: {
        petNo_followerPhone: {
          petNo,
          followerPhone: dto.followerPhone
        }
      },
      select: { id: true }
    });
    await this.prisma.communityFollow.upsert({
      where: {
        petNo_followerPhone: {
          petNo,
          followerPhone: dto.followerPhone
        }
      },
      update: { followerName: dto.followerName },
      create: {
        petId: pet.id,
        petNo,
        followerPhone: dto.followerPhone,
        followerName: dto.followerName
      }
    });

    return {
      petNo,
      followerPhone: dto.followerPhone,
      following: true,
      created: !existingFollow,
      followerCount: await this.prisma.communityFollow.count({ where: { petNo } })
    };
  }

  async reportPost(
    postNo: string,
    dto: AuthenticatedCommunityReportInput
  ): Promise<CommunityReportResponse> {
    await this.ensurePost(postNo);

    if (!this.isDatabaseConfigured()) {
      const existingReport = this.reports.find(
        (report) =>
          report.postNo === postNo &&
          report.memberPhone === dto.memberPhone &&
          report.status === "pending_review"
      );

      if (existingReport) {
        return { ...existingReport, created: false };
      }

      const report = {
        reportNo: this.createReportNo(),
        postNo,
        memberPhone: dto.memberPhone,
        reporterName: dto.reporterName,
        reason: dto.reason,
        status: "pending_review",
        createdAt: new Date().toISOString()
      } satisfies CommunityReportResponse;
      this.reports.unshift(report);
      this.refreshMemoryPostMetrics(postNo);
      return { ...report, created: true };
    }

    const existingReport = await this.prisma.communityReport.findFirst({
      where: {
        postNo,
        memberPhone: dto.memberPhone,
        status: "pending_review"
      },
      orderBy: { createdAt: "desc" }
    });

    if (existingReport) {
      return { ...this.toReportResponse(existingReport), created: false };
    }

    const post = await this.prisma.communityPost.findUniqueOrThrow({
      where: { postNo },
      select: { id: true }
    });
    const report = await this.prisma.communityReport.create({
      data: {
        reportNo: this.createReportNo(),
        postId: post.id,
        postNo,
        memberPhone: dto.memberPhone,
        reporterName: dto.reporterName,
        reason: dto.reason
      }
    });

    return { ...this.toReportResponse(report), created: true };
  }
  async listReports(
    filters: CommunityReportFilters = {}
  ): Promise<CommunityReportResponse[]> {
    if (!this.isDatabaseConfigured()) {
      return this.filterReports(this.reports, filters);
    }

    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.postNo ? { postNo: filters.postNo } : {}),
      ...(filters.memberPhone ? { memberPhone: filters.memberPhone } : {})
    };

    const reports = await this.prisma.communityReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return reports.map((report) => this.toReportResponse(report));
  }

  async updateReportStatus(
    reportNo: string,
    status: CommunityReportStatus,
    note?: string
  ): Promise<CommunityReportResponse> {
    if (!this.isDatabaseConfigured()) {
      const report = this.reports.find((item) => item.reportNo === reportNo);

      if (!report) {
        throw new NotFoundException("Community report not found");
      }

      report.status = status;
      report.note = note;
      report.resolvedAt = new Date().toISOString();
      return report;
    }

    const report = await this.prisma.communityReport.update({
      where: { reportNo },
      data: {
        status,
        note,
        resolvedAt: status === "pending_review" ? null : new Date()
      }
    });

    return this.toReportResponse(report);
  }

  async getEngagementByMemberPhone(
    phone: string
  ): Promise<CommunityEngagementSummary> {
    if (!this.isDatabaseConfigured()) {
      return {
        likedPostCount: Array.from(this.likes.values()).filter(
          (like) => like.memberPhone === phone
        ).length,
        commentCount: this.comments.filter(
          (comment) => comment.memberPhone === phone
        ).length,
        followingPetCount: Array.from(this.follows.values()).filter(
          (follow) => follow.followerPhone === phone
        ).length,
        reportCount: this.reports.filter((report) => report.memberPhone === phone)
          .length
      };
    }

    const [likedPostCount, commentCount, followingPetCount, reportCount] =
      await Promise.all([
        this.prisma.communityLike.count({ where: { memberPhone: phone } }),
        this.prisma.communityComment.count({ where: { memberPhone: phone } }),
        this.prisma.communityFollow.count({ where: { followerPhone: phone } }),
        this.prisma.communityReport.count({ where: { memberPhone: phone } })
      ]);

    return {
      likedPostCount,
      commentCount,
      followingPetCount,
      reportCount
    };
  }

  async updatePostStatus(
    postNo: string,
    status: CommunityPostStatus
  ): Promise<CommunityPostResponse> {
    if (!this.isDatabaseConfigured()) {
      const post = this.posts.find((item) => item.postNo === postNo);

      if (!post) {
        throw new NotFoundException("Community post not found");
      }

      post.status = status;
      return this.withCommerceBridge(post);
    }

    const post = await this.prisma.communityPost.update({
      where: { postNo },
      data: { status }
    });

    return this.withCommerceBridge(this.toResponse(post));
  }

  async getMetrics() {
    const posts = await this.listAdminPosts();

    return {
      communityPostCount: posts.length,
      hiddenCommunityPostCount: posts.filter((post) => post.status === "hidden")
        .length,
      pendingCommunityReportCount: (await this.listReports()).filter(
        (report) => report.status === "pending_review"
      ).length
    };
  }

  private toResponse(post: {
    postNo: string;
    petNo: string;
    petName: string;
    authorName: string;
    body: string;
    status: CommunityPostStatus;
    _count?: {
      likes: number;
      comments: number;
      reports: number;
    };
    likeCount?: number;
    commentCount?: number;
    reportCount?: number;
    authorDeletedAt?: Date | string | null;
    createdAt: Date | string;
  }): CommunityPostResponse {
    return {
      postNo: post.postNo,
      petNo: post.petNo,
      petName: post.petName,
      authorName: post.authorName,
      body: post.body,
      status: post.status,
      likeCount: post._count?.likes ?? post.likeCount ?? 0,
      commentCount: post._count?.comments ?? post.commentCount ?? 0,
      reportCount: post._count?.reports ?? post.reportCount ?? 0,
      authorDeletedAt: post.authorDeletedAt
        ? post.authorDeletedAt instanceof Date
          ? post.authorDeletedAt.toISOString()
          : post.authorDeletedAt
        : undefined,
      createdAt:
        post.createdAt instanceof Date
          ? post.createdAt.toISOString()
          : post.createdAt
    };
  }

  private async withCommerceBridge(
    post: CommunityPostResponse
  ): Promise<CommunityPostResponse> {
    const [recommendedProduct] = await this.cloudPetsService.getRecommendations(
      post.petNo
    );

    return {
      ...post,
      commerceBridge: {
        ctaHref: "/shop",
        ctaLabel: "选购推荐玩具",
        reason: recommendedProduct
          ? recommendedProduct.reason
          : `${post.petName}的社区动态可以继续连接到宠物商城。`,
        recommendedProduct: recommendedProduct
          ? {
              slug: recommendedProduct.slug,
              title: recommendedProduct.title,
              petType: recommendedProduct.petType,
              priceCents: recommendedProduct.priceCents
            }
          : undefined
      }
    };
  }

  private async withCommerceBridges(
    posts: CommunityPostResponse[]
  ): Promise<CommunityPostResponse[]> {
    return Promise.all(posts.map((post) => this.withCommerceBridge(post)));
  }

  private toCommentResponse(comment: {
    commentNo: string;
    postNo: string;
    memberPhone: string | null;
    authorName: string;
    body: string;
    status: CommunityPostStatus;
    authorDeletedAt?: Date | string | null;
    createdAt: Date | string;
  }): CommunityCommentResponse {
    return {
      commentNo: comment.commentNo,
      postNo: comment.postNo,
      memberPhone: comment.memberPhone ?? undefined,
      authorName: comment.authorName,
      body: comment.body,
      status: comment.status,
      authorDeletedAt: comment.authorDeletedAt
        ? comment.authorDeletedAt instanceof Date
          ? comment.authorDeletedAt.toISOString()
          : comment.authorDeletedAt
        : undefined,
      createdAt:
        comment.createdAt instanceof Date
          ? comment.createdAt.toISOString()
          : comment.createdAt
    };
  }

  private filterReports(
    reports: CommunityReportResponse[],
    filters: CommunityReportFilters
  ) {
    return reports.filter((report) => {
      if (filters.status && report.status !== filters.status) {
        return false;
      }

      if (filters.postNo && report.postNo !== filters.postNo) {
        return false;
      }

      if (filters.memberPhone && report.memberPhone !== filters.memberPhone) {
        return false;
      }

      return true;
    });
  }

  private toReportResponse(report: {
    reportNo: string;
    postNo: string;
    memberPhone: string | null;
    reporterName: string;
    reason: string;
    status: CommunityReportStatus;
    note: string | null;
    createdAt: Date | string;
    resolvedAt?: Date | string | null;
  }): CommunityReportResponse {
    return {
      reportNo: report.reportNo,
      postNo: report.postNo,
      memberPhone: report.memberPhone ?? undefined,
      reporterName: report.reporterName,
      reason: report.reason,
      status: report.status,
      note: report.note ?? undefined,
      createdAt:
        report.createdAt instanceof Date
          ? report.createdAt.toISOString()
          : report.createdAt,
      resolvedAt: report.resolvedAt
        ? report.resolvedAt instanceof Date
          ? report.resolvedAt.toISOString()
          : report.resolvedAt
        : undefined
    };
  }

  private async ensurePost(postNo: string) {
    if (!this.isDatabaseConfigured()) {
      const post = this.posts.find((item) => item.postNo === postNo);

      if (!post || post.status !== "visible" || post.authorDeletedAt) {
        throw new NotFoundException("Community post not found");
      }

      return post;
    }

    const post = await this.prisma.communityPost.findUnique({
      where: { postNo }
    });

    if (!post || post.status !== "visible" || post.authorDeletedAt) {
      throw new NotFoundException("Community post not found");
    }

    return post;
  }

  private postInclude() {
    return {
      _count: {
        select: {
          likes: true,
          comments: true,
          reports: true
        }
      }
    };
  }

  private visiblePostInclude() {
    return {
      _count: {
        select: {
          likes: true,
          comments: {
            where: { status: "visible" as const, authorDeletedAt: null }
          },
          reports: true
        }
      }
    };
  }

  private refreshMemoryPostMetrics(postNo: string) {
    const post = this.posts.find((item) => item.postNo === postNo);

    if (!post) {
      return;
    }

    post.likeCount = this.countMemoryLikes(postNo);
    post.commentCount = this.comments.filter(
      (comment) =>
        comment.postNo === postNo &&
        comment.status === "visible" &&
        !comment.authorDeletedAt
    ).length;
    post.reportCount = this.reports.filter((report) => report.postNo === postNo)
      .length;
  }

  private countMemoryLikes(postNo: string) {
    return Array.from(this.likes.values()).filter((like) => like.postNo === postNo)
      .length;
  }

  private countMemoryFollows(petNo: string) {
    return Array.from(this.follows.values()).filter(
      (follow) => follow.petNo === petNo
    ).length;
  }

  private createPostNo() {
    this.sequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `POST${timestamp}${String(this.sequence).padStart(4, "0")}`;
  }

  private createCommentNo() {
    this.commentSequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `CMT${timestamp}${String(this.commentSequence).padStart(4, "0")}`;
  }

  private createReportNo() {
    this.reportSequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `RPT${timestamp}${String(this.reportSequence).padStart(4, "0")}`;
  }

  private isDatabaseConfigured() {
    return (
      this.configService.get<string>("KZT_USE_MEMORY_STORE") !== "true" &&
      Boolean(this.configService.get<string>("DATABASE_URL"))
    );
  }
}
