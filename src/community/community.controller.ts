import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CommunityService } from "./community.service";
import { CreateCommunityCommentDto } from "./dto/create-community-comment.dto";
import { CreateCommunityFollowDto } from "./dto/create-community-follow.dto";
import { CreateCommunityLikeDto } from "./dto/create-community-like.dto";
import { CreateCommunityPostDto } from "./dto/create-community-post.dto";
import { CreateCommunityReportDto } from "./dto/create-community-report.dto";

@Controller("community")
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get("posts")
  async listPosts() {
    return {
      items: await this.communityService.listPosts()
    };
  }

  @Post("posts")
  createPost(@Body() dto: CreateCommunityPostDto) {
    return this.communityService.createPost(dto);
  }

  @Post("posts/:postNo/likes")
  likePost(
    @Param("postNo") postNo: string,
    @Body() dto: CreateCommunityLikeDto
  ) {
    return this.communityService.likePost(postNo, dto);
  }

  @Post("posts/:postNo/comments")
  commentOnPost(
    @Param("postNo") postNo: string,
    @Body() dto: CreateCommunityCommentDto
  ) {
    return this.communityService.commentOnPost(postNo, dto);
  }

  @Post("posts/:postNo/reports")
  reportPost(
    @Param("postNo") postNo: string,
    @Body() dto: CreateCommunityReportDto
  ) {
    return this.communityService.reportPost(postNo, dto);
  }

  @Post("pets/:petNo/follows")
  followPet(
    @Param("petNo") petNo: string,
    @Body() dto: CreateCommunityFollowDto
  ) {
    return this.communityService.followPet(petNo, dto);
  }
}
