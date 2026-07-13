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
    heroImage: "/brand/naigai-niangao/naigai-standard.png",
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
    heroImage: "/brand/naigai-niangao/niangao-standard.png",
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
   },
  {
    id: "entry-06",
    petId: "naigai",
    title: "窗边换位后，奶盖没有立刻走开",
    subtitle: "年糕先趴在垫子边等着，奶盖绕一圈后自己坐到了它旁边。",
    dateLabel: "2026.05.31",
    sortDate: "2026-05-31",
    mood: "松动",
    heroTone: "quiet",
    summary: "午后窗边有一块光，年糕今天没有追着贴，奶盖反而自己靠近，最后两只并排待了十几分钟。",
    intro:
      "今天中午我把窗边的小垫子挪了半步，想给它们都留点位置。年糕先过去趴下，尾巴只轻轻扫地，没有像以前那样兴奋地拱奶盖。奶盖在客厅边缘转了两圈，停下来看看窗外，再看看年糕，最后慢慢走过去，在离它一只爪子的距离坐下。",
    sections: [
      {
        heading: "年糕先学会了等",
        body:
          "它明明很想贴近，但今天一直压着动作，趴着的时候只抬头看奶盖，耳朵是放松的。以前它会因为太急把气氛弄紧，这次反而把节奏放稳了。"
      },
      {
        heading: "奶盖的靠近更像主动选择",
        body:
          "奶盖还是那副不紧不慢的样子，可它没有绕开，也没有跳上高处，而是自己走到年糕旁边坐下。它中途还回头看了我一眼，像是在确认这里是安全、安静的。"
      },
      {
        heading: "同框时间变长，是最真实的进展",
        body:
          "它们没有夸张互动，只是并排晒着光，偶尔一起看窗外的动静。没有谁先炸毛，也没有谁被赶走，这种平静地共处比热闹更说明问题。"
      }
    ],
    closingNote: "今天的变化很小，但能看见它们都在为彼此留位置。",
    tags: ["窗边", "同框", "关系推进"]
  },
  {
    id: "entry-07",
    petId: "niangao",
    title: "年糕吃完晚饭后，先去闻了闻奶盖的空碗",
    subtitle: "它没有急着抢最后一点香味，只在碗边停了停，又回头看了奶盖一眼。",
    dateLabel: "2026.06.02",
    sortDate: "2026-06-02",
    mood: "收着热情",
    heroTone: "warm",
    summary: "晚饭后年糕绕到奶盖那边闻了闻空碗，没有冒失地往前挤，奶盖也只抬头看它，没有把它赶开。",
    intro:
      "今天晚上它们吃饭的节奏刚好错开了半分钟。奶盖先吃完，跳到一边舔爪子，年糕把自己的那份解决掉之后，没有像以前那样立刻追着它跑，而是慢慢走到奶盖的饭碗旁边闻了闻。它闻得很认真，鼻尖几乎碰到碗沿，停了两秒，又转头去看坐在餐边柜下的奶盖，像是在确认自己这样靠近会不会惹它不高兴。",
    sections: [
      {
        heading: "年糕开始懂得把动作放慢",
        body:
          "它还是对奶盖的一切都很好奇，但那股热情没有再一下子扑出来。闻完碗边之后，它就站在原地，没有继续往奶盖脸前凑，只是尾巴小幅度地扫了两下地板。"
      },
      {
        heading: "奶盖这次只看着，没有护食似地赶它",
        body:
          "奶盖抬头的时候耳朵是竖着的，眼神也很清醒，但没有伸爪，也没有起身换地方。它甚至看完年糕以后又低头整理了一下胸口的毛，像是默认了这次短暂的靠近。"
      },
      {
        heading: "饭后的几秒钟，也能看出关系在变",
        body:
          "对它们来说，吃饭一直是边界最清楚的时候。年糕今天没冒进，奶盖今天没防备，这种彼此都退半步的默契，比任何热闹互动都更像一起生活久了之后才会有的样子。"
      }
    ],
    closingNote: "年糕终于学会先看奶盖的反应，而奶盖也开始允许它在自己的边界旁边多停一会儿。",
    tags: ["晚饭后", "边界感", "关系推进"]
  },
  {
    id: "entry-08",
    petId: "naigai",
    title: "奶盖今晚先躺下后，给年糕留了半张垫子",
    subtitle: "年糕本来只敢趴在边上，后来一点点挪近，奶盖也没有起身换地方。",
    dateLabel: "2026.06.03",
    sortDate: "2026-06-03",
    mood: "默认",
    heroTone: "soft",
    summary: "睡前奶盖先占了小垫子的里侧，年糕慢慢贴着边趴下，最后两只安静地挨着待了一会儿。",
    intro:
      "今天晚上关了客厅大灯之后，窗边只剩一盏落地灯亮着。奶盖照旧先跳上小垫子，把自己团在靠墙那一侧。年糕绕着垫子走了一圈，像是在判断自己能不能也留下，最后只敢把前爪搭在边上，肚子还落在地板上。奶盖抬头看了它一眼，尾巴轻轻甩了两下，但没有像以前那样直接走开，年糕这才一点点把身体挪上来，贴着垫子边安静趴下。",
    sections: [
      {
        heading: "奶盖先占位置，却没有把边界收得很死",
        body:
          "它还是习惯先选最安全的角落，背后靠着墙，脸朝着房间外面。但今晚它没有把自己摊得很开，反而留出了一小块空位，像是不经意地给旁边留了余地。"
      },
      {
        heading: "年糕这次靠近得很慢，也很会看脸色",
        body:
          "它没有一下扑上去，只是先把下巴搭在垫子边，确认奶盖没有不耐烦，才继续往前挪。整个过程里它几乎没发出声音，连尾巴都只是轻轻扫了一下地面。"
      },
      {
        heading: "睡前的安静，比白天的热闹更能说明关系",
        body:
          "它们最后没有贴得很紧，中间还留着一点呼吸的距离，可谁都没有先离开。对这两个小家伙来说，能在一天快结束的时候把安静分给彼此，已经很像家人之间自然的默契了。"
      }
    ],
    closingNote: "奶盖没有回头示意什么，但它今晚留下的那半张垫子，已经算很明确的接受。",
    tags: ["睡前", "同框", "关系推进"]
  },
  {
    id: "entry-09",
    petId: "niangao",
    title: "年糕今天把球停在奶盖脚边",
    subtitle: "它没有再急着往前拱，只是趴下来等奶盖先看一眼。",
    dateLabel: "2026.06.21",
    sortDate: "2026-06-21",
    mood: "耐心",
    heroTone: "warm",
    summary: "下午玩球时，年糕把小球推到奶盖脚边就停住了，奶盖没有立刻走开，还低头闻了一下球边。",
    intro:
      "今天下午雨停得很慢，客厅地板还有一点潮气。年糕叼着那颗浅黄色小球跑了两圈，本来已经朝我这边冲过来，路过奶盖的小垫子时却忽然放慢，把球轻轻放在奶盖前爪旁边。它没有像以前那样用鼻子顶奶盖，只是趴到半步外，眼睛亮亮地等着。",
    sections: [
      {
        heading: "年糕把邀请放得更轻了",
        body:
          "它还是很想一起玩，但今天没有把热情全压到奶盖身上。小球滚到爪边以后，它只用下巴贴着地板看奶盖，尾巴在身后小幅度地摇，像是在努力把自己的期待收稳一点。"
      },
      {
        heading: "奶盖没有马上拒绝这颗球",
        body:
          "奶盖先低头闻了闻球，又抬眼看年糕。它当然没有立刻加入游戏，可也没有转身跳走，只是把前爪往回收了一点，继续坐在原地观察。对奶盖来说，这已经是很明显的允许。"
      },
      {
        heading: "一起玩之前，先学会等对方",
        body:
          "这段关系最近的变化不是突然亲密，而是年糕越来越会停下来，奶盖也越来越少马上撤退。它们之间开始出现那种很短、很安静的等待，像是在给对方一点选择的时间。"
      }
    ],
    closingNote: "年糕今天没有得到一场完整的追球游戏，但它等到了奶盖愿意低头闻一闻，这已经很好。",
    tags: ["玩具", "耐心", "关系推进"]
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

