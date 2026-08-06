export type GrowthTaskCopyInput = {
  key: string;
  title: string;
  description: string;
};

const growthTaskCopy: Record<string, { title: string; description: string }> = {
  "daily-care": { title: "日常照护", description: "完成喂食、梳理或轻互动，为宠物留下每日照护记录。" },
  "feed-care": { title: "喂食记录", description: "记录今天的餐食与食欲，让宠物的日常节奏更鲜活。" },
  "play-care": { title: "一起玩耍", description: "安排一段简短互动，提升心情并维持亲密关系。" },
  "clean-care": { title: "清理空间", description: "整理宠物的小空间，补全今天的照护记录。" },
  "accompany-care": { title: "安静陪伴", description: "安静陪宠物待一会儿，记录今天的陪伴时刻。" },
  "community-share": { title: "社区分享", description: "发布一条宠物动态，让成长记录进入互动社区。" },
  "shop-gift": { title: "商城礼物", description: "从宠物主页选择推荐商品，连接内容与商城体验。" }
};

export function getGrowthTaskCopy(task: GrowthTaskCopyInput) {
  return growthTaskCopy[task.key] ?? task;
}
