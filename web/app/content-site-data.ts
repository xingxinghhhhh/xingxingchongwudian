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

export type JournalSection = {
  heading: string;
  body: string;
};

export type DiaryArchiveFilter = "all" | "naigai" | "niangao";

export type JournalEntry = {
  id: string;
  petId: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  sortDate: string;
  mood: string;
  heroTone: string;
  summary: string;
  intro: string;
  sections: JournalSection[];
  closingNote: string;
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
    subtitle: "它明明看见了，却只是甩了甩尾巴，没有转身离开。",
    dateLabel: "2026.04.05",
    sortDate: "2026-04-05",
    mood: "嘴硬",
    heroTone: "soft",
    summary: "年糕摇着尾巴靠过去，奶盖明明看见了，却只是甩了甩尾巴，没有走开。",
    intro:
      "那是一个很普通的下午，地毯上有一点刚晒过太阳的味道。年糕像平时一样先把热情交出来，而奶盖第一次没有把这份靠近推开。",
    sections: [
      {
        heading: "年糕先迈出了那一步",
        body:
          "它还是那副不管结果如何都想先试试看的样子，小短腿迈得很快，尾巴摇得也很认真，像已经默认自己终究会被接受。"
      },
      {
        heading: "奶盖没有像以前那样立刻撤开",
        body:
          "奶盖当然还是装得很冷静，眼神也还是那种‘我只是顺便看见’的眼神，可身体没有退后，这本身就已经是一次很明确的让步。"
      },
      {
        heading: "关系的变化，往往都小得像一个停顿",
        body:
          "真正重要的时刻并不总是热烈的。很多亲近，其实只是某一次没有躲开、某一次愿意多停一会儿。"
      }
    ],
    closingNote: "奶盖没有承认，但那天以后，它看向年糕的次数明显多了起来。",
    tags: ["初次靠近", "小情绪", "观察"]
  },
  {
    id: "entry-02",
    petId: "niangao",
    title: "年糕把玩具叼到奶盖面前",
    subtitle: "它把最喜欢的东西递过去，好像这样就能把喜欢也一起说明白。",
    dateLabel: "2026.04.11",
    sortDate: "2026-04-11",
    mood: "热情",
    heroTone: "warm",
    summary: "它认真地把最喜欢的玩具分享出去，结果奶盖看了一眼，继续高冷地舔爪子。",
    intro:
      "年糕总觉得关系是可以靠主动争取来的。它不懂试探，也不太会保留，一旦喜欢谁，就会直接把最珍贵的小玩具也一起叼过去。",
    sections: [
      {
        heading: "分享，是年糕最直接的示好方式",
        body:
          "它把玩具放下的时候眼神亮亮的，像在认真邀请奶盖进入自己的快乐世界，甚至已经默认这会是一次成功的互动。"
      },
      {
        heading: "奶盖还是先维持了高冷",
        body:
          "奶盖看了一眼，耳朵动了动，随后若无其事地继续舔爪子。那种淡定很像在说：我才不会这么轻易被你收买。"
      },
      {
        heading: "但热情本身不会白费",
        body:
          "就算这次没有得到回应，年糕也没有因此退缩。它的世界观很简单：只要还喜欢，就值得再靠近一次。"
      }
    ],
    closingNote: "年糕好像从不怕被拒绝，因为它更在意的是，自己有没有把喜欢送到。",
    tags: ["主动靠近", "分享", "委屈巴巴"]
  },
  {
    id: "entry-03",
    petId: "naigai",
    title: "奶盖偷偷守着睡着的年糕",
    subtitle: "它嘴上什么都没说，却偷偷把依赖先放到了行动里。",
    dateLabel: "2026.04.18",
    sortDate: "2026-04-18",
    mood: "偷偷在意",
    heroTone: "quiet",
    summary: "年糕睡着以后，奶盖又靠近了一点，像是不想承认自己其实已经开始习惯它了。",
    intro:
      "等年糕终于安静下来，整个客厅也跟着慢了。奶盖本来还坐在稍远一点的地方，后来一点一点挪近，像是在和自己做一场很轻的妥协。",
    sections: [
      {
        heading: "年糕睡着以后，世界忽然静下来",
        body:
          "没有热情的扑近，没有急着贴过来的小动作，只剩下均匀的呼吸和很安心的睡姿。那种安静，反而让奶盖有了靠近的余地。"
      },
      {
        heading: "奶盖的在意，总是发生在别人没看见的时候",
        body:
          "它不擅长把依赖摆在明面上，更不会像年糕那样直接表达。但越是没人注意的时候，它那些真正柔软的部分反而越明显。"
      },
      {
        heading: "依赖往往先于承认发生",
        body:
          "很多关系不是在某个正式瞬间被确认的，而是在一次次不自觉的靠近里慢慢变成事实。奶盖那晚多靠近的一点，就是这种事实。"
      }
    ],
    closingNote: "原来最嘴硬的那个，往往也是最先把人放进心里的那个。",
    tags: ["依赖", "陪伴", "偷看"]
  },
  {
    id: "entry-04",
    petId: "niangao",
    title: "年糕被拒绝贴贴后有点委屈",
    subtitle: "它的失落来得很快，但重新靠近也一样快。",
    dateLabel: "2026.04.24",
    sortDate: "2026-04-24",
    mood: "委屈巴巴",
    heroTone: "playful",
    summary: "它把耳朵都耷拉下来了，但过了三分钟，又甩着尾巴回来重新发起友好邀请。",
    intro:
      "年糕的情绪总是写在脸上，开心的时候很明显，委屈的时候也一样。那天它刚被奶盖轻轻躲开，整只小狗就像忽然少了一点光。",
    sections: [
      {
        heading: "委屈是很真实的",
        body:
          "它先是愣了一下，然后耳朵慢慢耷下来，连尾巴的速度都变慢了。那种受伤不是夸张的表演，而是真的没明白为什么这次又被拒绝。"
      },
      {
        heading: "但年糕的世界从来不往灰里待太久",
        body:
          "它会委屈，会难过，但这种情绪在它身上很少停留太久。过了一会儿，它又重新站起来，像在告诉自己：没关系，再试一次。"
      },
      {
        heading: "有些乐观，是天生的礼物",
        body:
          "年糕并不是不敏感，而是总能比失落更快地重新长出勇气。这种热情，也慢慢让奶盖对它放下了更多戒备。"
      }
    ],
    closingNote: "委屈巴巴的年糕只安静了几分钟，下一秒还是决定继续喜欢。",
    tags: ["贴贴", "小狗情绪", "永远开心"]
  },
  {
    id: "entry-05",
    petId: "naigai",
    title: "奶盖和年糕第一次一起晒太阳",
    subtitle: "不是突然变亲密，而是终于愿意在同一束光里待得更久一点。",
    dateLabel: "2026.05.02",
    sortDate: "2026-05-02",
    mood: "和解",
    heroTone: "warm",
    summary: "同一块地毯、同一束光、两个刚刚好的距离，它们终于开始像真正一起长大的家人。",
    intro:
      "那天的阳光很慢，客厅也很安静。奶盖先占了靠窗的位置，年糕后来也凑过去，而这一次，它们之间没有任何谁先离开。",
    sections: [
      {
        heading: "同框不再只是偶然",
        body:
          "以前它们也会在同一个空间里出现，但更多时候只是巧合。这一次的同框却不一样，因为它们都选择了留下。"
      },
      {
        heading: "刚刚好的距离，也是亲近的一种方式",
        body:
          "它们没有贴得很紧，也没有做出多夸张的互动，可那种自然共处的状态本身，就已经比很多热闹的举动更动人。"
      },
      {
        heading: "一起长大，不一定要很戏剧化",
        body:
          "有时候成长就是这样，看起来没什么惊天动地的变化，却会在某一天忽然发现：它们已经学会了在彼此身边放松下来。"
      }
    ],
    closingNote: "那束阳光没有说话，但它替这个家的关系往前照亮了一点点。",
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

export function getDiaryArchiveEntries(
  filter: DiaryArchiveFilter
): JournalEntry[] {
  if (filter === "all") {
    return getLatestJournalEntries(journalEntries, journalEntries.length);
  }

  return getJournalEntriesByPetId(filter);
}

export function getAdjacentJournalEntries(entryId: string): {
  previous: JournalEntry | undefined;
  next: JournalEntry | undefined;
} {
  const ordered = getLatestJournalEntries(journalEntries, journalEntries.length);
  const index = ordered.findIndex((entry) => entry.id === entryId);

  if (index === -1) {
    return {
      previous: undefined,
      next: undefined
    };
  }

  return {
    previous: ordered[index - 1],
    next: ordered[index + 1]
  };
}
