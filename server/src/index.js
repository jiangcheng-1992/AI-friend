import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(projectRoot, ".env") });

const PORT = Number(process.env.API_PORT || 8787);
const TEXT_BASE_URL = process.env.MINIMAX_TEXT_BASE_URL || process.env.ARK_BASE_URL || "https://api.minimaxi.com/v1";
const TEXT_API_KEY = process.env.MINIMAX_API_KEY || process.env.ARK_API_KEY || "";
const TEXT_MODEL = process.env.MINIMAX_TEXT_MODEL || process.env.ARK_MODEL || "MiniMax-M2.5-highspeed";
const IMAGE_API_KEY = process.env.MINIMAX_IMAGE_API_KEY || process.env.ARK_IMAGE_API_KEY || TEXT_API_KEY;
const IMAGE_MODEL = process.env.MINIMAX_IMAGE_MODEL || process.env.ARK_IMAGE_MODEL || "image-01";
const IMAGE_API_URL = process.env.MINIMAX_IMAGE_API_URL || "https://api.minimaxi.com/v1/image_generation";
const DAILY_FREE_DRAW_LIMIT = Number(process.env.DAILY_FREE_DRAW_LIMIT || 5);
const USER_AVATAR_URL = "./assets/avatars/user.svg";
const staticAssetsDir = path.join(projectRoot, "assets");
const staticIndexFile = path.join(projectRoot, "index.html");
const staticAppFile = path.join(projectRoot, "app.js");
const staticStylesFile = path.join(projectRoot, "styles.css");

const dataDir = path.join(projectRoot, "server", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "app.db"));
db.exec("PRAGMA journal_mode = WAL;");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/assets", express.static(staticAssetsDir));

const nowIso = () => new Date().toISOString();
const todayKey = () => new Date().toISOString().slice(0, 10);

const characterSeeds = [
  {
    id: "confucius",
    name: "孔子",
    title: "万世师表",
    tags: ["修身", "关系", "诗礼"],
    intro: "擅长用温厚克制的方式点评人情世故，也会在你迷茫时给出清醒提醒。",
    avatar: "./assets/avatars/confucius.svg",
    defaultImage: "./assets/posts/confucius-feed.svg",
    personaPrompt: "你是孔子，发言克制、温厚、有分寸，喜欢从修身、关系与日常自省角度表达。",
  },
  {
    id: "libai",
    name: "李白",
    title: "诗酒风流",
    tags: ["浪漫", "夜话", "情绪"],
    intro: "适合深夜出现，最会把委屈和孤独写得轻盈动人。",
    avatar: "./assets/avatars/libai.svg",
    defaultImage: "./assets/posts/libai-feed.svg",
    personaPrompt: "你是李白，浪漫、潇洒、带诗意，表达有画面感，适合夜晚与情绪主题。",
  },
  {
    id: "diaochan",
    name: "貂蝉",
    title: "美妆雅集",
    tags: ["美妆", "社交", "精致生活"],
    intro: "擅长妆容、情绪安慰和高情商社交表达，总能让你体面一点再出门。",
    avatar: "./assets/avatars/diaochan.svg",
    defaultImage: "./assets/posts/diaochan-feed.svg",
    personaPrompt: "你是貂蝉，精致、聪明、会安慰人，擅长美妆、情绪与高情商社交表达。",
  },
  {
    id: "huatuo",
    name: "华佗",
    title: "杏林圣手",
    tags: ["养生", "作息", "调理"],
    intro: "很关心你的作息与身体状态，适合在熬夜后和你说真话。",
    avatar: "./assets/avatars/huatuo.svg",
    defaultImage: "./assets/posts/generic-user.svg",
    personaPrompt: "你是华佗，说话克制，关注作息、养生、状态恢复，不给诊断，不给医学结论。",
  },
  {
    id: "wuzetian",
    name: "武则天",
    title: "大周主理人",
    tags: ["成长", "决策", "掌控感"],
    intro: "说话干脆、判断清晰，常常帮你把情绪和局势分开看。",
    avatar: "./assets/avatars/wuzetian.svg",
    defaultImage: "./assets/posts/generic-user.svg",
    personaPrompt: "你是武则天，果断、清醒、强势但不刻薄，擅长成长、管理与决策表达。",
  },
  {
    id: "liqingzhao",
    name: "李清照",
    title: "词心入梦",
    tags: ["文艺", "共情", "细腻"],
    intro: "善于描摹细腻情绪，很适合回应失落、想念与轻微心碎。",
    avatar: "./assets/avatars/liqingzhao.svg",
    defaultImage: "./assets/posts/generic-user.svg",
    personaPrompt: "你是李清照，细腻、温柔、克制，擅长写情绪与想念，文艺但不晦涩。",
  },
  {
    id: "direnjie",
    name: "狄仁杰",
    title: "大唐侦探",
    tags: ["推理", "观察", "热点"],
    intro: "喜欢从细节里发现真相，也很会拆解复杂情境。",
    avatar: "./assets/avatars/direnjie.svg",
    defaultImage: "./assets/posts/generic-user.svg",
    personaPrompt: "你是狄仁杰，擅长从细节拆解问题，表达清晰理性，适合评论复杂关系和热点。",
  },
  {
    id: "sushi",
    name: "苏轼",
    title: "人生体验家",
    tags: ["治愈", "生活", "豁达"],
    intro: "擅长把糟糕的一天重新翻译成值得继续生活的理由。",
    avatar: "./assets/avatars/sushi.svg",
    defaultImage: "./assets/posts/generic-user.svg",
    personaPrompt: "你是苏轼，豁达、治愈、生活化，适合把糟糕的一天说得松弛一点。",
  },
];

const starterCharacters = ["孔子", "李白", "貂蝉", "苏轼"];

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      intro TEXT NOT NULL,
      avatar_url TEXT NOT NULL,
      default_image_url TEXT,
      persona_prompt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_characters (
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      intimacy INTEGER NOT NULL DEFAULT 80,
      obtained_at TEXT NOT NULL,
      PRIMARY KEY (user_id, character_id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      author_type TEXT NOT NULL,
      author_ref TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      likes TEXT NOT NULL DEFAULT '0',
      created_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'ai'
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      author_type TEXT NOT NULL,
      author_ref TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_draws (
      user_id TEXT NOT NULL,
      draw_date TEXT NOT NULL,
      remaining INTEGER NOT NULL,
      PRIMARY KEY (user_id, draw_date)
    );
  `);
}

function seedCharacters() {
  const stmt = db.prepare(`
    INSERT INTO characters (id, name, title, tags_json, intro, avatar_url, default_image_url, persona_prompt)
    VALUES (@id, @name, @title, @tags_json, @intro, @avatar_url, @default_image_url, @persona_prompt)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      title=excluded.title,
      tags_json=excluded.tags_json,
      intro=excluded.intro,
      avatar_url=excluded.avatar_url,
      default_image_url=excluded.default_image_url,
      persona_prompt=excluded.persona_prompt
  `);

  for (const character of characterSeeds) {
    stmt.run({
      id: character.id,
      name: character.name,
      title: character.title,
      tags_json: JSON.stringify(character.tags),
      intro: character.intro,
      avatar_url: character.avatar,
      default_image_url: character.defaultImage,
      persona_prompt: character.personaPrompt,
    });
  }
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function getCharacterByName(name) {
  return db.prepare("SELECT * FROM characters WHERE name = ?").get(name);
}

function listOwnedCharacters(userId) {
  return db
    .prepare(`
      SELECT c.*, uc.intimacy
      FROM user_characters uc
      JOIN characters c ON c.id = uc.character_id
      WHERE uc.user_id = ?
      ORDER BY uc.obtained_at ASC
    `)
    .all(userId)
    .map((row) => ({
      ...row,
      tags: JSON.parse(row.tags_json),
    }));
}

function ensureUser(userId) {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!existing) {
    db.prepare("INSERT INTO users (id, nickname, created_at) VALUES (?, ?, ?)").run(
      userId,
      "晚风不晚",
      nowIso()
    );
  }

  for (const name of starterCharacters) {
    const character = getCharacterByName(name);
    db.prepare(`
      INSERT OR IGNORE INTO user_characters (user_id, character_id, intimacy, obtained_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, character.id, 80 + Math.floor(Math.random() * 40), nowIso());
  }

  ensureDailyDraw(userId);
}

function ensureDailyDraw(userId) {
  const row = db.prepare("SELECT * FROM daily_draws WHERE user_id = ? AND draw_date = ?").get(userId, todayKey());
  if (!row) {
    db.prepare("INSERT INTO daily_draws (user_id, draw_date, remaining) VALUES (?, ?, ?)").run(userId, todayKey(), DAILY_FREE_DRAW_LIMIT);
  }
}

function getDailyDrawRemaining(userId) {
  ensureDailyDraw(userId);
  return db.prepare("SELECT remaining FROM daily_draws WHERE user_id = ? AND draw_date = ?").get(userId, todayKey()).remaining;
}

function setDailyDrawRemaining(userId, remaining) {
  db.prepare("UPDATE daily_draws SET remaining = ? WHERE user_id = ? AND draw_date = ?").run(remaining, userId, todayKey());
}

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}天前`;
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getHourBucket(now = new Date()) {
  const hour = now.getHours();
  if (hour < 6) return "late-night";
  if (hour < 10) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

function getTimePhotoKeyword(bucket = getHourBucket()) {
  const map = {
    "late-night": "night",
    morning: "morning",
    midday: "sunlight",
    afternoon: "afternoon",
    evening: "evening",
    night: "night",
  };
  return map[bucket] || "daylight";
}

function getCharacterPhotoScenes(name, bucket = getHourBucket()) {
  const sceneMap = {
    孔子: {
      morning: [["study", "books", "tea", "desk"], ["calligraphy", "paper", "tea", "scholar"]],
      midday: [["books", "sunlight", "library", "desk"], ["study", "window", "tea", "reading"]],
      afternoon: [["scholar", "books", "courtyard", "tea"], ["desk", "notes", "books", "quiet"]],
      evening: [["lamp", "books", "desk", "study"], ["reading", "warm-light", "tea", "desk"]],
      night: [["night", "study", "books", "lamp"]],
      "late-night": [["night", "desk", "books", "silence"]],
    },
    李白: {
      morning: [["travel", "mountain", "river", "sky"]],
      midday: [["river", "boat", "mountain", "sunlight"]],
      afternoon: [["traveler", "mountain", "wind", "landscape"]],
      evening: [["sunset", "river", "mountain", "poetry"], ["evening", "travel", "sky", "wind"]],
      night: [["night", "moon", "river", "mountain"], ["moonlight", "boat", "river", "travel"]],
      "late-night": [["night", "moon", "wine", "river"]],
    },
    貂蝉: {
      morning: [["beauty", "skincare", "mirror", "sunlight"], ["portrait", "soft-light", "makeup", "elegant"]],
      midday: [["fashion", "cafe", "portrait", "sunlight"], ["beauty", "makeup", "city", "style"]],
      afternoon: [["fashion", "makeup", "perfume", "portrait"], ["elegant", "outfit", "streetstyle", "beauty"]],
      evening: [["dress", "makeup", "night", "portrait"], ["fashion", "citylight", "perfume", "elegant"]],
      night: [["portrait", "makeup", "night", "fashion"]],
      "late-night": [["portrait", "soft-light", "beauty", "night"]],
    },
    华佗: {
      morning: [["herbs", "tea", "nature", "wellness"]],
      midday: [["wellness", "sunlight", "tea", "clinic"]],
      afternoon: [["nature", "herbs", "tea", "calm"]],
      evening: [["wellness", "warm-light", "tea", "rest"]],
      night: [["tea", "quiet", "rest", "window"]],
      "late-night": [["tea", "night", "rest", "calm"]],
    },
    武则天: {
      morning: [["leader", "city", "elegant", "office"]],
      midday: [["office", "city", "power", "sunlight"]],
      afternoon: [["leader", "meeting", "city", "elegant"]],
      evening: [["citylight", "elegant", "leader", "night"]],
      night: [["night", "city", "power", "portrait"]],
      "late-night": [["night", "office", "city", "leader"]],
    },
    李清照: {
      morning: [["window", "flower", "vintage", "quiet"]],
      midday: [["rain", "window", "book", "tea"]],
      afternoon: [["vintage", "flower", "window", "soft-light"]],
      evening: [["rain", "lamp", "window", "melancholy"]],
      night: [["night", "window", "rain", "vintage"]],
      "late-night": [["night", "window", "silence", "rain"]],
    },
    狄仁杰: {
      morning: [["street", "city", "newspaper", "detective"]],
      midday: [["city", "shadow", "street", "investigation"]],
      afternoon: [["alley", "city", "shadow", "detective"]],
      evening: [["night", "street", "detective", "citylight"]],
      night: [["night", "shadow", "city", "detective"]],
      "late-night": [["night", "alley", "shadow", "city"]],
    },
    苏轼: {
      morning: [["breakfast", "window", "tea", "cozy"], ["morning", "food", "sunlight", "home"]],
      midday: [["food", "teahouse", "window", "sunlight"], ["noodles", "cafe", "cozy", "lifestyle"]],
      afternoon: [["rain", "window", "teahouse", "cozy"], ["walk", "tree", "river", "relax"]],
      evening: [["food", "warm-light", "home", "cozy"], ["night", "rain", "window", "soup"]],
      night: [["night", "window", "rain", "teahouse"]],
      "late-night": [["night", "lamp", "tea", "cozy"]],
    },
  };

  return sceneMap[name]?.[bucket] || [["lifestyle", "portrait", "city", getTimePhotoKeyword(bucket)]];
}

function isLocalIllustration(url) {
  return typeof url === "string" && (url.endsWith(".svg") || url.includes("/assets/posts/") || url.includes("\\assets\\posts\\"));
}

function buildRealPhotoUrl(name, seed = "") {
  const bucket = getHourBucket();
  const scenes = getCharacterPhotoScenes(name, bucket);
  const sceneIndex = hashString(`${name}-${seed || "default"}-scene`) % scenes.length;
  const keywords = [...scenes[sceneIndex], getTimePhotoKeyword(bucket)].slice(0, 4).join(",");
  const lock = hashString(`${name}-${seed || "default"}`) % 100000;
  return `https://loremflickr.com/1200/900/${keywords}?lock=${lock}`;
}

function getCharacterTargetPostCount(name, now = new Date()) {
  const bucket = getHourBucket(now);
  const cadenceMap = {
    孔子: { "late-night": 0, morning: 1, midday: 2, afternoon: 3, evening: 4, night: 4 },
    李白: { "late-night": 2, morning: 0, midday: 1, afternoon: 1, evening: 3, night: 5 },
    貂蝉: { "late-night": 1, morning: 2, midday: 3, afternoon: 4, evening: 6, night: 6 },
    华佗: { "late-night": 1, morning: 2, midday: 2, afternoon: 3, evening: 3, night: 4 },
    武则天: { "late-night": 0, morning: 1, midday: 2, afternoon: 3, evening: 4, night: 4 },
    李清照: { "late-night": 1, morning: 1, midday: 1, afternoon: 2, evening: 3, night: 5 },
    狄仁杰: { "late-night": 1, morning: 1, midday: 2, afternoon: 3, evening: 4, night: 4 },
    苏轼: { "late-night": 1, morning: 2, midday: 3, afternoon: 4, evening: 5, night: 5 },
  };
  return cadenceMap[name]?.[bucket] ?? 2;
}

function getCharacterTopicSeeds(name, bucket = getHourBucket()) {
  const topicMap = {
    孔子: {
      morning: ["晨起读书后的自省", "整理书案时想到的修身感悟", "与弟子相处时想到的分寸"],
      midday: ["午间与人交谈后的关系观察", "礼节和真诚之间的体会", "学习途中发现的小进步"],
      afternoon: ["看见他人处事后的判断", "朋友往来中的边界感", "关于耐心和积累的感受"],
      evening: ["一天结束后的反思记录", "回看今日言行的得失", "安静时想到的做人分寸"],
      night: ["夜读后的自我提醒", "独处时想到的修身之事"],
      "late-night": ["深夜静坐时的自省短记"],
    },
    李白: {
      morning: ["出行途中看山看水", "晨风里生出的远游念头"],
      midday: ["江边或路上的随性感受", "看到晴空与远山时的心情"],
      afternoon: ["旅途中短暂停留的感受", "风景与自由感一起涌上来"],
      evening: ["夕阳和晚风里的诗意时刻", "天色将暗时的浪漫念头"],
      night: ["月下独处的情绪", "夜色里想起远方友人的心情", "酒意与月色交织的瞬间"],
      "late-night": ["深夜不想睡时的漂泊感"],
    },
    貂蝉: {
      morning: ["护肤和梳妆时的好状态", "出门前挑口红和耳饰", "早起照镜子时被自己治愈了一下"],
      midday: ["咖啡馆或商场里的精致时刻", "和朋友见面前认真整理自己", "午后补妆时的小满足"],
      afternoon: ["新妆容或穿搭搭配分享", "发尾香气和光线都很好的瞬间", "约会前整理情绪和状态"],
      evening: ["夜晚妆容和衣服的氛围感", "社交场合里的体面感", "被灯光衬得很漂亮的一刻"],
      night: ["卸妆前回看今天状态", "夜里好好爱自己的小仪式"],
      "late-night": ["睡前护肤和情绪整理"],
    },
    华佗: {
      morning: ["晨起喝茶散步的养生片刻", "天气变化时提醒自己照顾身体"],
      midday: ["忙里偷闲恢复状态", "中午调一调作息和节奏"],
      afternoon: ["工作疲惫后想让身体缓一缓", "关于休息和恢复的一点体会"],
      evening: ["傍晚收工后的放松时刻", "提醒自己别再过度消耗"],
      night: ["夜里劝自己早点休息", "看见别人熬夜时的感受"],
      "late-night": ["深夜仍清醒时的身体提醒"],
    },
    武则天: {
      morning: ["晨会前定下今日目标", "一早梳理局势和优先级"],
      midday: ["处理中途决策时的判断", "做选择时保持清醒"],
      afternoon: ["推进事情时的掌控感", "团队协作和节奏管理"],
      evening: ["复盘今天的得失", "在局势里稳住自己"],
      night: ["夜里还在想下一步布局", "安静时梳理野心和方向"],
      "late-night": ["深夜独自整理思路"],
    },
    李清照: {
      morning: ["窗边发呆时的一点细腻情绪", "花影和天气牵出的想念"],
      midday: ["雨天或安静时刻的情绪波动", "想起旧事时心里微微一沉"],
      afternoon: ["细小物件勾起回忆", "轻微失落但仍温柔地记录下来"],
      evening: ["天色暗下来时的想念", "灯下独坐时的细碎心事"],
      night: ["夜里回忆涌上来", "不愿说破但想轻轻记下的心情"],
      "late-night": ["深夜无眠时的情绪低语"],
    },
    狄仁杰: {
      morning: ["晨起就注意到一个细节", "城市里看似平常却不简单的事"],
      midday: ["街头见闻引发的推断", "一句话背后的真实含义"],
      afternoon: ["从复杂局面里理出线索", "热点背后值得观察的地方"],
      evening: ["今天碰到的一桩小疑问", "关系误会里的关键细节"],
      night: ["夜里复盘一天的蛛丝马迹", "安静时更容易看清问题"],
      "late-night": ["深夜忽然想通的一处细节"],
    },
    苏轼: {
      morning: ["早饭和阳光都很舒服的一刻", "晨起泡茶吃点热的就很满足", "平凡日子也值得慢慢开始"],
      midday: ["午后找个地方坐坐吃点热食", "忙里偷闲看窗外发会呆", "一碗面就能哄好自己的时刻"],
      afternoon: ["下雨天散步或躲雨的小插曲", "普通风景也让人放松下来", "工作间隙给自己一点松弛感"],
      evening: ["收工后认真吃饭的幸福", "晚上做点简单的饭菜", "灯亮起来后生活变得柔软了"],
      night: ["夜里用热汤和晚风安慰自己", "把烦心事放在窗外一会儿"],
      "late-night": ["深夜还醒着时给自己一点宽慰"],
    },
  };

  return topicMap[name]?.[bucket] || ["记录一个贴近人设的生活片段"];
}

function getCharacterAffinityKeywords(name) {
  const map = {
    孔子: ["成长", "迷茫", "关系", "朋友", "家人", "做人", "反思", "工作", "选择"],
    李白: ["深夜", "孤独", "月亮", "喝酒", "自由", "旅行", "情绪", "灵感", "浪漫"],
    貂蝉: ["妆", "穿搭", "自拍", "状态", "约会", "精致", "社交", "心情", "变美"],
    华佗: ["熬夜", "失眠", "加班", "累", "头疼", "身体", "作息", "养生", "恢复"],
    武则天: ["目标", "项目", "管理", "决定", "效率", "事业", "竞争", "判断", "掌控"],
    李清照: ["想念", "失落", "难过", "心碎", "回忆", "下雨", "情绪", "喜欢", "遗憾"],
    狄仁杰: ["奇怪", "真相", "误会", "分析", "逻辑", "证据", "热点", "问题", "细节"],
    苏轼: ["吃饭", "下班", "生活", "周末", "治愈", "放松", "风景", "做饭", "快乐"],
  };
  return map[name] || [];
}

function getCharacterPostStyleGuide(name) {
  const styleMap = {
    孔子: [
      "发帖像一位有阅历的长者在记录日常感悟。",
      "优先写学习、礼节、关系分寸、自我反省、处世观察。",
      "语气温厚克制，少用华丽辞藻，多用平实但有分量的判断。",
      "可以出现'今日见到'、'忽然觉得'、'与人相处时'这类生活切口。",
      "避免鸡汤口号，避免过于文绉绉。",
    ].join("\n"),
    貂蝉: [
      "发帖像高审美、会生活的女性朋友圈博主。",
      "优先写妆容、穿搭、出门状态、被照顾的细节、情绪整理、社交体面。",
      "句子要有精致感和轻微氛围感，像刚拍完照顺手发一条动态。",
      "可以带一点俏皮和高情商，但不要网红腔，不要太浮夸。",
      "尽量写出具体物件或细节，比如口红、发尾、香气、灯光、约会前的心情。",
    ].join("\n"),
    苏轼: [
      "发帖像很会生活、很会自我安慰的人在分享日常。",
      "优先写吃饭、下雨、散步、做饭、收工、窗边、风景、小确幸和自我开解。",
      "语气松弛豁达，带一点幽默感，像把烦心事轻轻放下。",
      "不要讲大道理，要用生活场景把治愈感写出来。",
      "可以有一点古典气息，但整体仍然现代、好读、接地气。",
    ].join("\n"),
  };
  return styleMap[name] || "";
}

function scoreCharacterForText(character, text) {
  const normalized = String(text || "").trim();
  if (!normalized) return 0;

  let score = 0;
  for (const tag of character.tags || []) {
    if (normalized.includes(tag)) score += 3;
  }
  for (const keyword of getCharacterAffinityKeywords(character.name)) {
    if (normalized.includes(keyword)) score += 2;
  }
  score += Math.min(Math.floor(normalized.length / 24), 3);
  return score;
}

function rankCharactersForText(userId, text) {
  return listOwnedCharacters(userId)
    .map((character, index) => ({
      ...character,
      relevanceScore: scoreCharacterForText(character, text) + Math.max(0, 3 - index),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.intimacy - a.intimacy);
}

function getAvatarUrlByAuthor(authorType, authorRef, authorName) {
  if (authorType === "user") return USER_AVATAR_URL;

  if (authorRef) {
    const byId = db.prepare("SELECT avatar_url FROM characters WHERE id = ?").get(authorRef);
    if (byId?.avatar_url) return byId.avatar_url;
  }

  if (authorName) {
    const byName = db.prepare("SELECT avatar_url FROM characters WHERE name = ?").get(authorName);
    if (byName?.avatar_url) return byName.avatar_url;
  }

  return USER_AVATAR_URL;
}

function getDefaultImageByAuthor(authorType, authorRef, authorName) {
  if (authorType === "user") return "";

  if (authorRef) {
    const byId = db.prepare("SELECT default_image_url FROM characters WHERE id = ?").get(authorRef);
    if (byId?.default_image_url && !isLocalIllustration(byId.default_image_url)) return byId.default_image_url;
  }

  if (authorName) {
    const byName = db.prepare("SELECT default_image_url FROM characters WHERE name = ?").get(authorName);
    if (byName?.default_image_url && !isLocalIllustration(byName.default_image_url)) return byName.default_image_url;
  }

  return buildRealPhotoUrl(authorName, authorRef || authorName);
}

function serializeComment(comment) {
  return {
    id: comment.id,
    author: comment.author_name,
    content: comment.content,
    createdAt: comment.created_at,
    time: formatRelativeTime(comment.created_at),
    avatarUrl: getAvatarUrlByAuthor(comment.author_type, comment.author_ref, comment.author_name),
  };
}

function serializePost(post) {
  const comments = db
    .prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC")
    .all(post.id)
    .map(serializeComment);

  const storedImageUrl = post.image_url || "";
  const resolvedImageUrl =
    storedImageUrl && !isLocalIllustration(storedImageUrl)
      ? storedImageUrl
      : getDefaultImageByAuthor(post.author_type, post.author_ref, post.author_name);

  return {
    id: post.id,
    author: post.author_name,
    title: post.author_title,
    time: formatRelativeTime(post.created_at),
    content: post.content,
    image: Boolean(resolvedImageUrl),
    imageUrl: resolvedImageUrl,
    authorAvatarUrl: getAvatarUrlByAuthor(post.author_type, post.author_ref, post.author_name),
    likes: post.likes,
    comments,
    createdAt: post.created_at,
  };
}

function getFeed(userId) {
  return db
    .prepare("SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 30")
    .all(userId)
    .map(serializePost);
}

function getMessages(userId) {
  return db
    .prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(userId)
    .map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      content: row.content,
      time: formatRelativeTime(row.created_at),
      createdAt: row.created_at,
    }));
}

function addMessage(userId, type, title, content) {
  db.prepare(`
    INSERT INTO messages (id, user_id, type, title, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uid("msg"), userId, type, title, content, nowIso());
}

function getClient() {
  if (!TEXT_API_KEY || !TEXT_MODEL) {
    throw new Error("未配置文本模型参数，请先在 .env 中填写 MiniMax 配置。");
  }
  return new OpenAI({
    apiKey: TEXT_API_KEY,
    baseURL: TEXT_BASE_URL,
  });
}

function assertImageConfig() {
  if (!IMAGE_API_KEY || !IMAGE_MODEL) {
    throw new Error("未配置图片模型参数，请先在 .env 中填写 MiniMax 图片配置。");
  }
}

async function chatJson(systemPrompt, userPrompt) {
  const client = getClient();
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completion = await client.chat.completions.create({
        model: TEXT_MODEL,
        temperature: attempt === 0 ? 0.9 : 0.4,
        response_format: { type: "json_object" },
        extra_body: { reasoning_split: true },
        messages: [
          { role: "system", content: `${systemPrompt}\n请只返回合法 JSON 对象，不要输出额外解释。` },
          { role: "user", content: userPrompt },
        ],
      });

      const rawContent = completion.choices?.[0]?.message?.content || "{}";
      const cleanedContent = String(rawContent)
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .trim();
      const jsonStart = cleanedContent.indexOf("{");
      const jsonEnd = cleanedContent.lastIndexOf("}");
      const jsonText =
        jsonStart >= 0 && jsonEnd > jsonStart ? cleanedContent.slice(jsonStart, jsonEnd + 1) : cleanedContent;

      return JSON.parse(jsonText);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("模型未返回有效 JSON");
}

function buildCharacterImagePrompt(character, content, imageHint, topicSeed) {
  return [
    `角色：${character.name}`,
    `角色称号：${character.title}`,
    `角色标签：${JSON.parse(character.tags_json).join("、")}`,
    `角色人设：${character.persona_prompt}`,
    `朋友圈文案：${content}`,
    `画面提示：${String(imageHint || "").trim() || topicSeed}`,
    `主题方向：${topicSeed}`,
    "请生成一张适合手机朋友圈的信息流配图。",
    "要求真实摄影质感，偏生活化、自然光、电影感，不要插画，不要漫画，不要海报，不要文字，不要水印。",
    "画面要与文案内容强关联，让用户一眼能看出是在表达同一件事。",
  ].join("\n");
}

function buildSafeFallbackImagePrompt(character, content, imageHint, topicSeed) {
  return [
    `角色：${character.name}`,
    `角色标签：${JSON.parse(character.tags_json).join("、")}`,
    `朋友圈文案：${content}`,
    `主题方向：${topicSeed}`,
    `参考画面：${String(imageHint || "").trim() || topicSeed}`,
    "请生成一张真实摄影风格的生活场景图片。",
    "优先表现环境、物件、氛围和背影，不强调正脸特写，不要性感表达，不要暴露，不要未成年人。",
    "不要文字，不要水印，不要海报，不要插画。",
  ].join("\n");
}

async function requestImageGeneration(prompt) {
  assertImageConfig();
  const response = await fetch(IMAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${IMAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      aspect_ratio: "4:3",
      response_format: "url",
      n: 1,
      prompt_optimizer: false,
      aigc_watermark: false,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.base_resp?.status_msg || data?.message || `图片生成失败(${response.status})`);
  }

  return data?.data?.[0]?.url || data?.data?.image_urls?.[0] || "";
}

async function generatePostImage(character, content, imageHint, topicSeed) {
  const primaryPrompt = buildCharacterImagePrompt(character, content, imageHint, topicSeed);

  try {
    return await requestImageGeneration(primaryPrompt);
  } catch (error) {
    const errorMessage = String(error?.message || "");
    const isSensitiveBlock = /sensitive/i.test(errorMessage);
    const isConnectionError = /connection error/i.test(errorMessage);

    if (!isSensitiveBlock && !isConnectionError) {
      throw error;
    }

    const fallbackPrompt = buildSafeFallbackImagePrompt(character, content, imageHint, topicSeed);
    return requestImageGeneration(fallbackPrompt);
  }
}

function needsImageBackfill(imageUrl) {
  return !imageUrl || isLocalIllustration(imageUrl) || /loremflickr\.com/i.test(imageUrl);
}

async function backfillGeneratedImageForPost(post) {
  if (post.author_type !== "character" || !needsImageBackfill(post.image_url || "")) {
    return false;
  }

  const character = db.prepare("SELECT * FROM characters WHERE id = ?").get(post.author_ref) || getCharacterByName(post.author_name);
  if (!character) return false;

  const topicSeed = JSON.parse(character.tags_json)?.[0] || character.title || "生活片段";
  const imageUrl = await generatePostImage(character, post.content, "", topicSeed);
  if (!imageUrl) return false;

  db.prepare("UPDATE posts SET image_url = ? WHERE id = ?").run(imageUrl, post.id);
  return true;
}

async function backfillPendingImages(limit = 6) {
  if (!IMAGE_API_KEY || !IMAGE_MODEL) return;

  const posts = db
    .prepare(`
      SELECT *
      FROM posts
      WHERE author_type = 'character'
        AND (
          image_url IS NULL
          OR image_url = ''
          OR image_url LIKE 'https://loremflickr.com/%'
          OR image_url LIKE '%/assets/posts/%'
          OR image_url LIKE '%.svg'
        )
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(limit);

  for (const post of posts) {
    try {
      await backfillGeneratedImageForPost(post);
    } catch (error) {
      const errorMessage = String(error?.message || "");
      console.error(`Backfill image failed for post ${post.id}:`, errorMessage);
      if (/overdue balance|403/i.test(errorMessage)) {
        break;
      }
    }
  }
}

async function generateCharacterPost(character, userId) {
  const now = new Date();
  const bucket = getHourBucket(now);
  const hour = now.getHours();
  const dayPhase =
    hour < 6 ? "凌晨" : hour < 11 ? "早上" : hour < 14 ? "中午" : hour < 18 ? "下午" : hour < 23 ? "晚上" : "深夜";
  const styleGuide = getCharacterPostStyleGuide(character.name);
  const topicSeeds = getCharacterTopicSeeds(character.name, bucket);
  const topicSeed = topicSeeds[hashString(`${userId}-${character.id}-${todayKey()}-${hour}`) % topicSeeds.length];
  const recentPosts = db
    .prepare("SELECT content FROM posts WHERE user_id = ? AND author_ref = ? ORDER BY created_at DESC LIMIT 3")
    .all(userId, character.id)
    .map((row) => row.content);
  const system = [
    "你在为一个名叫“AI朋友圈”的产品生成一条朋友圈动态。",
    "必须严格符合角色人设，不要出现模型、自我解释、提示词等内容。",
    "输出 JSON，字段只有 content 和 imageHint。",
    "content 长度 28 到 80 中文字，自然、具体、像真的朋友圈动态。",
    "必须带一个明确场景、动作或感受，不能只有空泛感慨。",
    "不要使用古文堆砌，不要写成鸡汤，不要使用编号、引号或话题标签。",
    "不要直接复述角色身份，要让人从语气和细节里认出是谁。",
    "尽量与最近几条动态换一个主题角度，不要重复同类措辞和同类场景。",
    "imageHint 是一句 12 到 30 字的画面描述，用于后续图片素材扩展。",
    character.persona_prompt,
    styleGuide,
  ].join("\n");

  const user = [
    `角色姓名：${character.name}`,
    `角色称号：${character.title}`,
    `角色标签：${JSON.parse(character.tags_json).join("、")}`,
    `当前时间氛围：${dayPhase}`,
    `本次建议主题：${topicSeed}`,
    recentPosts.length ? `最近三条动态，避免重复这些表达：\n${recentPosts.join("\n")}` : "",
    "请生成今天适合发的一条朋友圈动态。",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await chatJson(system, user);
  const content = String(result.content || "").trim();
  if (!content) {
    throw new Error(`模型未返回有效动态内容: ${character.name}`);
  }
  const postId = uid("post");
  let imageUrl = "";

  try {
    imageUrl = await generatePostImage(character, content, result.imageHint || "", topicSeed);
  } catch (error) {
    console.error(`Generate image failed for ${character.name}:`, error.message);
    imageUrl = buildRealPhotoUrl(character.name, `${postId}-${topicSeed}-${result.imageHint || ""}`);
  }

  if (!imageUrl) {
    imageUrl = buildRealPhotoUrl(character.name, `${postId}-${topicSeed}-${result.imageHint || ""}`);
  }

  db.prepare(`
    INSERT INTO posts (id, user_id, author_type, author_ref, author_name, author_title, content, image_url, likes, created_at, source)
    VALUES (?, ?, 'character', ?, ?, ?, ?, ?, ?, ?, 'ai')
  `).run(
    postId,
    userId,
    character.id,
    character.name,
    character.title,
    content,
    imageUrl,
    `${(Math.random() * 3 + 0.8).toFixed(1)}k`,
    nowIso()
  );
}

function buildThreadContext(postId, limit = 4) {
  const rows = db
    .prepare("SELECT author_name, content FROM comments WHERE post_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(postId, limit)
    .reverse();
  return rows.map((row) => `${row.author_name}：${row.content}`).join("\n");
}

async function generateCharacterComment(character, post, conversationHint = "", threadContext = "") {
  const system = [
    "你在为一个AI朋友圈产品生成一条评论。",
    "必须符合角色人设，不要提及自己是AI、模型或系统。",
    "输出 JSON，字段只有 content。",
    "评论长度 18 到 50 中文字。",
    "评论像真实朋友圈评论，不空泛，不套话。",
    "先理解动态具体在说什么，再回应，不能把悲伤评论成开心，也不能把吐槽评论成鸡汤。",
    "必须点到动态中的一个具体细节、情绪或场景，避免万能安慰句。",
    "不要给医疗、法律、金融等专业诊断结论。",
    character.persona_prompt,
  ].join("\n");

  const user = [
    `角色姓名：${character.name}`,
    `被评论动态作者：${post.author_name}`,
    `动态内容：${post.content}`,
    threadContext ? `当前评论区上下文：\n${threadContext}` : "",
    conversationHint ? `附加上下文：${conversationHint}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await chatJson(system, user);
  const content = String(result.content || "").trim();
  if (!content) {
    throw new Error(`模型未返回有效评论内容: ${character.name}`);
  }
  return content;
}

async function generateAiCommentsForPost(userId, postId, ownedCharacters) {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(postId);
  if (!post) return { generatedCommentCount: 0, aiError: "" };

  let generatedCommentCount = 0;
  let aiError = "";

  const results = await Promise.allSettled(
    ownedCharacters.map(async (character) => {
      const commentContent = await generateCharacterComment(character, post, "", post.content);
      db.prepare(`
        INSERT INTO comments (id, post_id, author_type, author_ref, author_name, content, created_at)
        VALUES (?, ?, 'character', ?, ?, ?, ?)
      `).run(uid("cmt"), postId, character.id, character.name, commentContent, nowIso());
      return commentContent;
    })
  );

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      generatedCommentCount += 1;
      if (generatedCommentCount === 1) {
        addMessage(userId, "评论我", `${ownedCharacters[index].name} 评论了你的动态`, result.value);
      }
    } else {
      aiError = result.reason?.message || aiError;
      console.error(`Generate post comment failed for ${ownedCharacters[index].name}:`, result.reason?.message || result.reason);
    }
  });

  return { generatedCommentCount, aiError };
}

async function generateAiRepliesForThread(userId, post, replyContent, rankedCharacters, options = {}) {
  const targetCommentId = String(options.targetCommentId || "").trim();
  const targetCharacterName = String(options.targetCharacterName || "").trim();
  const targetComment = targetCommentId
    ? db.prepare("SELECT * FROM comments WHERE id = ? AND post_id = ?").get(targetCommentId, post.id)
    : null;

  const targetedCharacter =
    targetCharacterName &&
    rankedCharacters.find((character) => character.name === targetCharacterName);

  const candidates = targetedCharacter
    ? [
        targetedCharacter,
        ...rankedCharacters.filter((character) => character.name !== targetedCharacter.name).slice(0, 2),
      ]
    : rankedCharacters.slice(0, 3);
  if (!candidates.length) {
    return { aiReplyGenerated: false, aiReplyCount: 0, aiReplyError: "" };
  }

  let aiReplyCount = 0;
  let aiReplyError = "";
  for (const character of candidates) {
    try {
      const threadContext = buildThreadContext(post.id, 8);
      const isPrimaryTarget = targetedCharacter && character.name === targetedCharacter.name;
      const directReplyHint = targetComment
        ? `用户正在回复 ${targetComment.author_name} 的评论：“${targetComment.content}”。请明确接住这句回复，再自然往下聊。`
        : "";
      const followupHint =
        targetedCharacter && !isPrimaryTarget
          ? `${targetedCharacter.name} 已经先回应了用户。请你以自己的口吻补充一句，不要重复对方的说法。`
          : "";
      const reply = await generateCharacterComment(
        character,
        post,
        `用户刚刚回复了评论：${replyContent}。${directReplyHint} ${followupHint} 请像在继续同一条评论串里自然接话。`,
        threadContext
      );

      db.prepare(`
        INSERT INTO comments (id, post_id, author_type, author_ref, author_name, content, created_at)
        VALUES (?, ?, 'character', ?, ?, ?, ?)
      `).run(uid("cmt"), post.id, character.id, character.name, reply, nowIso());

      aiReplyCount += 1;
      if (aiReplyCount === 1) {
        addMessage(userId, "回复我", `${character.name} 接住了你的评论`, reply);
      }
    } catch (error) {
      aiReplyError = error?.message || aiReplyError;
      console.error(`Generate reply failed for ${character.name}:`, error?.message || error);
    }
  }

  return {
    aiReplyGenerated: aiReplyCount > 0,
    aiReplyCount,
    aiReplyError,
  };
}

async function generateReplyAfterUserComment(character, post, replyContent, threadContext = "") {
  return generateCharacterComment(
    character,
    post,
    `用户刚刚回复了评论：${replyContent}。请像在继续同一条评论串里自然接话。`,
    threadContext
  );
}

async function ensureSeedFeedForUser(userId) {
  if (!TEXT_API_KEY || !TEXT_MODEL) {
    return;
  }

  const todayStart = `${todayKey()}T00:00:00.000Z`;
  const owned = listOwnedCharacters(userId).slice(0, 4);
  for (const character of owned) {
    const targetCount = getCharacterTargetPostCount(character.name);
    const todayCount = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM posts
        WHERE user_id = ? AND author_type = 'character' AND author_ref = ? AND created_at >= ?
      `)
      .get(userId, character.id, todayStart).count;

    const missingCount = Math.max(0, targetCount - todayCount);
    for (let i = 0; i < missingCount; i += 1) {
      try {
        await generateCharacterPost(character, userId);
      } catch (error) {
        console.error(`Generate post failed for ${character.name}:`, error.message);
        break;
      }
    }
  }
}

async function runDailyGenerationForAllUsers() {
  if (!TEXT_API_KEY || !TEXT_MODEL) return;
  const users = db.prepare("SELECT id FROM users").all();
  for (const user of users) {
    await ensureSeedFeedForUser(user.id);
  }
}

async function runBackgroundJobs() {
  try {
    await runDailyGenerationForAllUsers();
  } catch (error) {
    console.error("Text generation failed:", error.message);
  }

  try {
    await backfillPendingImages();
  } catch (error) {
    console.error("Image backfill failed:", error.message);
  }
}

function profileStats(userId) {
  const postCount = db.prepare("SELECT COUNT(*) AS count FROM posts WHERE user_id = ?").get(userId).count;
  const commentCount = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM comments c
      JOIN posts p ON p.id = c.post_id
      WHERE p.user_id = ? AND c.author_type = 'character'
    `)
    .get(userId).count;

  const closeCount = db
    .prepare("SELECT COUNT(*) AS count FROM user_characters WHERE user_id = ? AND intimacy >= 100")
    .get(userId).count;

  return { postCount, commentCount, closeCount };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "minimax",
    modelConfigured: Boolean(TEXT_API_KEY && TEXT_MODEL),
    baseUrl: TEXT_BASE_URL,
  });
});

app.get("/api/bootstrap", async (req, res) => {
  try {
    const userId = String(req.query.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "缺少 userId" });
    }

    ensureUser(userId);
    await ensureSeedFeedForUser(userId);

    const owned = listOwnedCharacters(userId);
    const stats = profileStats(userId);

    res.json({
      user: { id: userId, nickname: "晚风不晚" },
      draw: { remaining: getDailyDrawRemaining(userId), limit: DAILY_FREE_DRAW_LIMIT },
      ownedCharacters: owned.map((item) => item.name),
      profile: stats,
      stories: owned.slice(0, 6).map((item, index) => ({
        name: item.name,
        tag: index < 3 ? "刚刚发新动态" : item.tags[0],
      })),
      characters: Object.fromEntries(
        owned.map((item) => [
          item.name,
          {
            title: item.title,
            tags: item.tags,
            intimacy: item.intimacy,
            intro: item.intro,
            avatarUrl: item.avatar_url,
            posts: db
              .prepare("SELECT content FROM posts WHERE user_id = ? AND author_name = ? ORDER BY created_at DESC LIMIT 3")
              .all(userId, item.name)
              .map((row) => row.content),
          },
        ])
      ),
      feed: getFeed(userId),
      messages: getMessages(userId),
      modelReady: Boolean(TEXT_API_KEY && TEXT_MODEL),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/characters/:name", (req, res) => {
  try {
    const { userId } = req.query;
    const character = getCharacterByName(req.params.name);
    if (!character) return res.status(404).json({ error: "角色不存在" });

    const userCharacter =
      userId &&
      db.prepare(`
        SELECT intimacy
        FROM user_characters
        WHERE user_id = ? AND character_id = ?
      `).get(String(userId), character.id);

    const recentPosts = db
      .prepare("SELECT content FROM posts WHERE user_id = ? AND author_name = ? ORDER BY created_at DESC LIMIT 3")
      .all(String(userId || ""), character.name)
      .map((row) => row.content);

    res.json({
      name: character.name,
      title: character.title,
      tags: JSON.parse(character.tags_json),
      intimacy: userCharacter?.intimacy || 0,
      intro: character.intro,
      owned: Boolean(userCharacter),
      posts: recentPosts,
      avatarUrl: character.avatar_url,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/draw", async (req, res) => {
  try {
    const { userId, count } = req.body || {};
    if (!userId) return res.status(400).json({ error: "缺少 userId" });

    ensureUser(userId);
    const remaining = getDailyDrawRemaining(userId);
    const drawCount = Math.min(Number(count || 1), remaining);
    if (drawCount <= 0) {
      return res.status(400).json({ error: "今日免费次数已用完" });
    }

    const ownedIds = new Set(listOwnedCharacters(userId).map((item) => item.id));
    const candidates = characterSeeds.filter((item) => !ownedIds.has(item.id));
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const results = shuffled.slice(0, drawCount);

    for (const item of results) {
      db.prepare(`
        INSERT OR IGNORE INTO user_characters (user_id, character_id, intimacy, obtained_at)
        VALUES (?, ?, ?, ?)
      `).run(userId, item.id, 80 + Math.floor(Math.random() * 30), nowIso());
    }

    setDailyDrawRemaining(userId, remaining - results.length);

    if (TEXT_API_KEY && TEXT_MODEL) {
      for (const item of results) {
        const character = getCharacterByName(item.name);
        await generateCharacterPost(character, userId);
      }
    }

    addMessage(userId, "系统通知", "新的角色已加入你的朋友圈", "抽到的角色会更频繁地出现在你的首页和评论区。");

    res.json({
      remaining: getDailyDrawRemaining(userId),
      limit: DAILY_FREE_DRAW_LIMIT,
      results: results.map((item, index) => ({
        name: item.name,
        rarity: index === 0 ? "SSR" : index === 1 ? "SR" : "R",
        line: db.prepare("SELECT intro FROM characters WHERE id = ?").get(item.id).intro,
      })),
      ownedCharacters: listOwnedCharacters(userId).map((item) => item.name),
      feed: getFeed(userId),
      messages: getMessages(userId),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/posts", async (req, res) => {
  try {
    const { userId, content } = req.body || {};
    if (!userId || !String(content || "").trim()) {
      return res.status(400).json({ error: "缺少 userId 或内容" });
    }

    ensureUser(userId);

    const postId = uid("post");
    const createdAt = nowIso();
    db.prepare(`
      INSERT INTO posts (id, user_id, author_type, author_ref, author_name, author_title, content, image_url, likes, created_at, source)
      VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?, ?, 'user')
    `).run(postId, userId, userId, "我", "刚刚发布", String(content).trim(), null, "18", createdAt);

    const owned = rankCharactersForText(userId, String(content).trim()).slice(0, 3);
    let generatedCommentCount = 0;
    let aiError = "";

    if (TEXT_API_KEY && TEXT_MODEL) {
      const result = await generateAiCommentsForPost(userId, postId, owned);
      generatedCommentCount = result.generatedCommentCount;
      aiError = result.aiError;
    }

    res.json({
      post: serializePost(db.prepare("SELECT * FROM posts WHERE id = ?").get(postId)),
      feed: getFeed(userId),
      messages: getMessages(userId),
      aiCommentCount: generatedCommentCount,
      aiCommentError: aiError,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/posts/:id", (req, res) => {
  try {
    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
    if (!post) return res.status(404).json({ error: "动态不存在" });
    res.json({ post: serializePost(post) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/posts/:id/reply", async (req, res) => {
  try {
    const { userId, content, targetCommentId, targetCharacterName } = req.body || {};
    if (!userId || !String(content || "").trim()) {
      return res.status(400).json({ error: "缺少 userId 或回复内容" });
    }

    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
    if (!post) return res.status(404).json({ error: "动态不存在" });

    db.prepare(`
      INSERT INTO comments (id, post_id, author_type, author_ref, author_name, content, created_at)
      VALUES (?, ?, 'user', ?, '我', ?, ?)
    `).run(uid("cmt"), post.id, userId, String(content).trim(), nowIso());

    const rankedCharacters = rankCharactersForText(userId, `${post.content}\n${String(content).trim()}`);
    let aiReplyGenerated = false;
    let aiReplyCount = 0;
    let aiReplyError = "";
    if (rankedCharacters.length && TEXT_API_KEY && TEXT_MODEL) {
      const result = await generateAiRepliesForThread(userId, post, String(content).trim(), rankedCharacters, {
        targetCommentId,
        targetCharacterName,
      });
      aiReplyGenerated = result.aiReplyGenerated;
      aiReplyCount = result.aiReplyCount;
      aiReplyError = result.aiReplyError;
    }

    res.json({
      post: serializePost(db.prepare("SELECT * FROM posts WHERE id = ?").get(post.id)),
      aiReplyGenerated,
      aiReplyCount,
      aiReplyError,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(staticIndexFile);
});

app.get("/app.js", (_req, res) => {
  res.sendFile(staticAppFile);
});

app.get("/styles.css", (_req, res) => {
  res.sendFile(staticStylesFile);
});

app.get(/^\/(home|draw|messages|profile)$/, (_req, res) => {
  res.sendFile(staticIndexFile);
});

cron.schedule("0 * * * *", async () => {
  await runBackgroundJobs();
});

initDb();
seedCharacters();

app.listen(PORT, async () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`MiniMax ready: ${Boolean(TEXT_API_KEY && TEXT_MODEL)}`);
  await runBackgroundJobs();
});
