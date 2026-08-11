import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "../auth/auth.service";
import { CloudPetsService } from "../cloud-pets/cloud-pets.service";
import { CommunityService } from "./community.service";
import { CreateCommunityCommentDto } from "./dto/create-community-comment.dto";
import { CreateCommunityFollowDto } from "./dto/create-community-follow.dto";
import { CreateCommunityLikeDto } from "./dto/create-community-like.dto";
import { CreateCommunityPostDto } from "./dto/create-community-post.dto";
import { CreateCommunityReportDto } from "./dto/create-community-report.dto";
import { UpdateCommunityPostDto } from "./dto/update-community-post.dto";

@Controller("community")
export class CommunityController {
  constructor(
    private readonly authService: AuthService,
    private readonly cloudPetsService: CloudPetsService,
    private readonly communityService: CommunityService
  ) {}

  @Get("posts")
  async listPosts() {
    return {
      items: await this.communityService.listPosts()
    };
  }

  @Get("posts/following")
  async listFollowingPosts(@Headers("x-member-token") sessionToken?: string) {
    const session = await this.authService.getSession(sessionToken);

    return {
      items: await this.communityService.listFollowedPostsByMemberPhone(
        session.phone
      )
    };
  }

  @Post("posts")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async createPost(
    @Body() dto: CreateCommunityPostDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const [session, pet] = await Promise.all([
      this.authService.getSession(sessionToken),
      this.cloudPetsService.getPet(dto.petNo)
    ]);

    if (pet.ownerPhone !== session.phone) {
      throw new ForbiddenException("Pet does not belong to current member");
    }

    const body = dto.body.trim();

    if (!body) {
      throw new BadRequestException("Community post body cannot be blank");
    }

    return this.communityService.createPost({
      ...dto,
      authorName: session.name,
      memberPhone: session.phone,
      body
    });
  }

  @Patch("posts/:postNo")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async updatePost(
    @Param("postNo") postNo: string,
    @Body() dto: UpdateCommunityPostDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.communityService.updatePost(postNo, session.phone, dto.body);
  }

  @Delete("posts/:postNo")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async withdrawPost(
    @Param("postNo") postNo: string,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.communityService.withdrawPost(postNo, session.phone);
  }

  @Delete("comments/:commentNo")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async withdrawComment(
    @Param("commentNo") commentNo: string,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.communityService.withdrawComment(commentNo, session.phone);
  }

  @Get("posts/:postNo")
  async getPost(@Param("postNo") postNo: string) {
    return this.communityService.getPost(postNo);
  }

  @Post("posts/:postNo/likes")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async likePost(
    @Param("postNo") postNo: string,
    @Body() dto: CreateCommunityLikeDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.communityService.likePost(postNo, {
      ...dto,
      memberPhone: session.phone,
      authorName: session.name
    });
  }

  @Get("posts/:postNo/comments")
  async listComments(@Param("postNo") postNo: string) {
    return {
      items: await this.communityService.listComments(postNo)
    };
  }

  @Post("posts/:postNo/comments")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async commentOnPost(
    @Param("postNo") postNo: string,
    @Body() dto: CreateCommunityCommentDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const session = await this.authService.getSession(sessionToken);
    const body = dto.body.trim();

    if (!body) {
      throw new BadRequestException("Community comment body cannot be blank");
    }

    return this.communityService.commentOnPost(postNo, {
      ...dto,
      body,
      memberPhone: session.phone,
      authorName: session.name
    });
  }

  @Post("posts/:postNo/reports")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reportPost(
    @Param("postNo") postNo: string,
    @Body() dto: CreateCommunityReportDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const session = await this.authService.getSession(sessionToken);
    const reason = dto.reason.trim();

    if (!reason) {
      throw new BadRequestException("Community report reason cannot be blank");
    }

    return this.communityService.reportPost(postNo, {
      ...dto,
      reason,
      memberPhone: session.phone,
      reporterName: session.name
    });
  }

  @Post("pets/:petNo/follows")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async followPet(
    @Param("petNo") petNo: string,
    @Body() dto: CreateCommunityFollowDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.communityService.followPet(petNo, {
      ...dto,
      followerPhone: session.phone,
      followerName: session.name
    });
  }
}
