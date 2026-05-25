import { Body, Controller, Get, Post } from "@nestjs/common";
import { CommunityService } from "./community.service";
import { CreateCommunityPostDto } from "./dto/create-community-post.dto";

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
}
