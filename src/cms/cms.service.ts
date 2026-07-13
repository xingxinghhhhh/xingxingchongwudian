import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { CmsBlockStatus, CreateCmsBlockDto } from "./dto/create-cms-block.dto";

export interface CmsBlockRecord {
  blockNo: string;
  slotKey: string;
  title: string;
  body: string;
  ctaLabel?: string;
  href?: string;
  imageUrl?: string;
  status: CmsBlockStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CmsService {
  private readonly blocks: CmsBlockRecord[] = [];
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async createBlock(dto: CreateCmsBlockDto): Promise<CmsBlockRecord> {
    const block = {
      blockNo: this.createBlockNo(),
      slotKey: dto.slotKey,
      title: dto.title,
      body: dto.body,
      ctaLabel: dto.ctaLabel,
      href: dto.href,
      imageUrl: dto.imageUrl,
      status: dto.status ?? "draft",
      sortOrder: dto.sortOrder ?? 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } satisfies CmsBlockRecord;

    if (!this.isDatabaseConfigured()) {
      this.blocks.unshift(block);
      return block;
    }

    const savedBlock = await this.prisma.cmsBlock.create({
      data: {
        blockNo: block.blockNo,
        slotKey: block.slotKey,
        title: block.title,
        body: block.body,
        ctaLabel: block.ctaLabel,
        href: block.href,
        imageUrl: block.imageUrl,
        status: block.status,
        sortOrder: block.sortOrder
      }
    });

    return this.toRecord(savedBlock);
  }

  async listAdminBlocks(): Promise<CmsBlockRecord[]> {
    if (!this.isDatabaseConfigured()) {
      return this.sortBlocks(this.blocks);
    }

    const blocks = await this.prisma.cmsBlock.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 100
    });

    return blocks.map((block) => this.toRecord(block));
  }

  async listPublishedBlocksBySlotPrefix(slotPrefix: string) {
    const blocks = await this.listAdminBlocks();

    return blocks.filter(
      (block) =>
        block.status === "published" && block.slotKey.startsWith(slotPrefix)
    );
  }

  async updateBlockStatus(
    blockNo: string,
    status: CmsBlockStatus
  ): Promise<CmsBlockRecord> {
    if (!this.isDatabaseConfigured()) {
      const block = this.blocks.find((item) => item.blockNo === blockNo);

      if (!block) {
        throw new NotFoundException("CMS block not found");
      }

      block.status = status;
      block.updatedAt = new Date().toISOString();
      return block;
    }

    const block = await this.prisma.cmsBlock.update({
      where: { blockNo },
      data: { status }
    });

    return this.toRecord(block);
  }

  private sortBlocks(blocks: CmsBlockRecord[]) {
    return [...blocks].sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });
  }

  private toRecord(block: {
    blockNo: string;
    slotKey: string;
    title: string;
    body: string;
    ctaLabel: string | null;
    href: string | null;
    imageUrl: string | null;
    status: string;
    sortOrder: number;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): CmsBlockRecord {
    return {
      blockNo: block.blockNo,
      slotKey: block.slotKey,
      title: block.title,
      body: block.body,
      ctaLabel: block.ctaLabel ?? undefined,
      href: block.href ?? undefined,
      imageUrl: block.imageUrl ?? undefined,
      status: block.status as CmsBlockStatus,
      sortOrder: block.sortOrder,
      createdAt:
        block.createdAt instanceof Date
          ? block.createdAt.toISOString()
          : block.createdAt,
      updatedAt:
        block.updatedAt instanceof Date
          ? block.updatedAt.toISOString()
          : block.updatedAt
    };
  }

  private createBlockNo() {
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

    return `CMS${timestamp}${String(this.sequence).padStart(4, "0")}`;
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }
}
