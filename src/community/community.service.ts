import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CloudPetsService } from "../cloud-pets/cloud-pets.service";
import { PrismaService } from "../database/prisma.service";
import { CreateCommunityPostDto } from "./dto/create-community-post.dto";

export interface CommunityPostResponse {
  postNo: string;
  petNo: string;
  petName: string;
  authorName: string;
  body: string;
  createdAt: string;
}

interface CommunityPostRecord extends CommunityPostResponse {
  createdAt: string;
}

@Injectable()
export class CommunityService {
  private readonly posts: CommunityPostRecord[] = [];
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cloudPetsService: CloudPetsService
  ) {}

  async createPost(dto: CreateCommunityPostDto): Promise<CommunityPostResponse> {
    const pet = await this.cloudPetsService.getPetRecord(dto.petNo);
    const postNo = this.createPostNo();

    if (!this.isDatabaseConfigured()) {
      const post = {
        postNo,
        petNo: pet.petNo,
        petName: pet.name,
        authorName: dto.authorName,
        body: dto.body,
        createdAt: new Date().toISOString()
      };
      this.posts.unshift(post);
      return post;
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

    return {
      postNo: post.postNo,
      petNo: post.petNo,
      petName: post.petName,
      authorName: post.authorName,
      body: post.body,
      createdAt: post.createdAt.toISOString()
    };
  }

  async listPosts(): Promise<CommunityPostResponse[]> {
    if (!this.isDatabaseConfigured()) {
      return this.posts;
    }

    const posts = await this.prisma.communityPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return posts.map((post) => ({
      postNo: post.postNo,
      petNo: post.petNo,
      petName: post.petName,
      authorName: post.authorName,
      body: post.body,
      createdAt: post.createdAt.toISOString()
    }));
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

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }
}
