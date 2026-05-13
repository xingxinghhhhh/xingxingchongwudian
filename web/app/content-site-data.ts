export type PetType = "cat" | "dog";

export type PetProfile = {
  id: string;
  name: string;
  type: PetType;
  role: string;
  ageLabel: string;
  breedLabel: string;
  temperament: string;
  keywords: string[];
  favoriteThing: string;
  signatureColor: string;
  heroImage: string;
  heroImagePosition: string;
  summary: string;
};

export type StoryChapter = {
  id: string;
  title: string;
  summary: string;
};

export type JournalEntry = {
  id: string;
  petId: string;
  title: string;
  dateLabel: string;
  sortDate: string;
  mood: string;
  summary: string;
  tags: string[];
};

export type FavoriteMoment = {
  id: string;
  label: string;
  detail: string;
};

export type AboutChapter = {
  id: string;
  title: string;
  summary: string;
};

export const brandName = "奶盖和年糕";
export const accountName = "奶盖和年糕的 AI 成长日记";
export const accountTagline =
  "记录奶盖和年糕一起长大的日常，也记录陪伴是怎么慢慢发生的。";
export const worldSummary =
  "奶盖和年糕住在一个温暖的原木风小家里，一个高冷嘴硬，一个热情粘人，它们从陌生到熟悉，一起长大，也一起陪伴“我”的生活。";

export const socialBios = {
  douyin:
    "一只傲娇小猫奶盖，一只社牛小狗年糕。记录它们一起长大的日常，也记录陪伴慢慢发生。",
  xiaohongshu:
    "奶盖和年糕住在原木风小家里，一个嘴硬慢热，一个热情粘人。这里写它们的成长，也写我和它们的陪伴。",
  weibo:
    "奶盖和年糕的 AI 成长日记：一只高冷小猫和一只社牛小狗，从陌生到熟悉，一起长大。"
} as const;

export const aboutChapters: AboutChapter[] = [
  {
    id: "about-01",
    title: "为什么开始记录",
    summary:
      "因为有些陪伴真的很容易被日常吞掉。奶盖的偷看、年糕的贴贴、它们之间那些不算大事的小情绪，其实都值得被认真留下。"
  },
  {
    id: "about-02",
    title: "我和它们的关系",
    summary:
      "我不是站在外面的讲述者，而是和它们一起生活的人。这个账号记录的不只是两只宠物，也是在记录我们三个人慢慢变熟、慢慢互相依赖的过程。"
  },
  {
    id: "about-03",
    title: "这个账号以后会长成什么",
    summary:
      "先从奶盖和年糕开始，把宠物档案、成长日记和互动情绪写扎实。后面再自然长成定制云养宠、宠物主页和用户社区。"
  }
];

export const pets: PetProfile[] = [
  {
    id: "naigai",
    name: "奶盖",
    type: "cat",
    role: "傲娇观察员",
    ageLabel: "1 岁 6 个月",
    breedLabel: "奶油白 / 浅米色短毛猫",
    temperament: "傲娇、慢热、嘴硬、爱吃醋，表面嫌弃，实际很依赖主人",
    keywords: ["高冷", "嘴硬", "偷偷在意", "表面嫌弃", "实际依赖"],
    favoriteThing: "窗边晒太阳、偷偷盯着年糕、羽毛逗猫棒",
    signatureColor: "奶油白",
    heroImage: "/images/naigai-niangao.png",
    heroImagePosition: "left center",
    summary:
      "奶盖总是一副“我才没有在意”的样子，可每次你起身、年糕靠近、门外有动静，它都会第一个偷偷看过去。"
  },
  {
    id: "niangao",
    name: "年糕",
    type: "dog",
    role: "社牛贴贴员",
    ageLabel: "8 个月",
    breedLabel: "浅棕白色柯基幼犬",
    temperament: "社牛、热情、粘人、笨笨的、乐观，永远都想和奶盖做朋友",
    keywords: ["热情", "贴贴", "委屈巴巴", "主动靠近", "永远开心"],
    favoriteThing: "追着奶盖跑、门口等人回家、圆滚滚地趴在脚边",
    signatureColor: "浅棕白",
    heroImage: "/images/naigai-niangao.png",
    heroImagePosition: "right center",
    summary:
      "年糕把每一次靠近都当成新的机会，哪怕奶盖转身走开，它也会甩着小短腿再试一次。"
  }
];

export const storyChapters: StoryChapter[] = [
  {
    id: "chapter-01",
    title: "从陌生到同住",
    summary:
      "奶盖先远远看，年糕先热情扑。一个不肯承认在意，一个恨不得马上做朋友。故事就从这份温差开始。"
  },
  {
    id: "chapter-02",
    title: "把小情绪都记录下来",
    summary:
      "谁先吃醋，谁先示好，谁在门口等，谁在窗边偷看。它们的情绪很小，却很值得被认真留下。"
  },
  {
    id: "chapter-03",
    title: "在原木风小家里一起长大",
    summary:
      "温暖的地毯、午后的阳光、餐前的脚步声，慢慢把这两个小家伙和“我”的生活织成了同一条时间线。"
  }
];

export const journalEntries: JournalEntry[] = [
  {
    id: "entry-01",
    petId: "naigai",
    title: "奶盖第一次没有躲开年糕",
    dateLabel: "2026.04.05",
    sortDate: "2026-04-05",
    mood: "嘴硬",
    summary: "年糕摇着尾巴靠过去，奶盖明明看见了，却只是甩了甩尾巴，没有走开。",
    tags: ["初次靠近", "小情绪", "观察"]
  },
  {
    id: "entry-02",
    petId: "niangao",
    title: "年糕把玩具叼到奶盖面前",
    dateLabel: "2026.04.11",
    sortDate: "2026-04-11",
    mood: "热情",
    summary: "它认真地把最喜欢的玩具分享出去，结果奶盖看了一眼，继续高冷地舔爪子。",
    tags: ["主动靠近", "分享", "委屈巴巴"]
  },
  {
    id: "entry-03",
    petId: "naigai",
    title: "奶盖偷偷守着睡着的年糕",
    dateLabel: "2026.04.18",
    sortDate: "2026-04-18",
    mood: "偷偷在意",
    summary: "年糕睡着以后，奶盖又靠近了一点，像是不想承认自己其实已经开始习惯它了。",
    tags: ["依赖", "陪伴", "偷看"]
  },
  {
    id: "entry-04",
    petId: "niangao",
    title: "年糕被拒绝贴贴后有点委屈",
    dateLabel: "2026.04.24",
    sortDate: "2026-04-24",
    mood: "委屈巴巴",
    summary: "它把耳朵都耷拉下来了，但过了三分钟，又甩着尾巴回来重新发起友好邀请。",
    tags: ["贴贴", "小狗情绪", "永远开心"]
  },
  {
    id: "entry-05",
    petId: "naigai",
    title: "奶盖和年糕第一次一起晒太阳",
    dateLabel: "2026.05.02",
    sortDate: "2026-05-02",
    mood: "和解",
    summary: "同一块地毯、同一束光、两个刚刚好的距离，它们终于开始像真正一起长大的家人。",
    tags: ["双主角", "同框", "原木风日常"]
  }
];

export const favoriteMoments: FavoriteMoment[] = [
  {
    id: "favorite-01",
    label: "早晨开窗",
    detail: "奶盖先去看树影，年糕先去看门口，两个完全不同的期待把一天轻轻打开。"
  },
  {
    id: "favorite-02",
    label: "吃饭前两分钟",
    detail: "年糕围着你转圈圈，奶盖坐远一点假装不急，可耳朵早就已经竖起来了。"
  },
  {
    id: "favorite-03",
    label: "睡前巡视",
    detail: "奶盖最后检查窗边，年糕最后确认你在哪儿，这就是它们各自表达安心的方式。"
  }
];

export function getLatestJournalEntries(
  entries: JournalEntry[],
  count: number
): JournalEntry[] {
  return [...entries]
    .sort((left, right) => right.sortDate.localeCompare(left.sortDate))
    .slice(0, count);
}

export function getPetById(petId: string): PetProfile | undefined {
  return pets.find((pet) => pet.id === petId);
}

export function getJournalEntryById(entryId: string): JournalEntry | undefined {
  return journalEntries.find((entry) => entry.id === entryId);
}

export function getJournalEntriesByPetId(petId: string): JournalEntry[] {
  return journalEntries
    .filter((entry) => entry.petId === petId)
    .sort((left, right) => right.sortDate.localeCompare(left.sortDate));
}
