import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(projectRoot, ".env") });

const IMAGE_API_KEY = process.env.MINIMAX_IMAGE_API_KEY || process.env.ARK_IMAGE_API_KEY || process.env.MINIMAX_API_KEY || process.env.ARK_API_KEY || "";
const IMAGE_MODEL = process.env.MINIMAX_IMAGE_MODEL || process.env.ARK_IMAGE_MODEL || "image-01";
const IMAGE_API_URL = process.env.MINIMAX_IMAGE_API_URL || "https://api.minimaxi.com/v1/image_generation";

if (!IMAGE_API_KEY) {
  throw new Error("未配置图片模型 Key，无法生成角色头像。");
}

const outputDir = path.join(projectRoot, "assets", "avatars", "generated");
fs.mkdirSync(outputDir, { recursive: true });

const avatars = [
  {
    id: "confucius",
    prompt:
      "真实摄影风格的东亚男性头像，五十岁上下，温厚、克制、儒雅，古风中式衣袍，肩颈以上近景，柔和自然光，干净深色背景，适合社交 App 头像，不要文字，不要水印。",
  },
  {
    id: "libai",
    prompt:
      "真实摄影风格的东亚男性头像，三十岁上下，浪漫洒脱，古风文人气质，略带诗意与夜色氛围，中长发束起，肩颈以上近景，电影感光线，适合社交 App 头像，不要文字，不要水印。",
  },
  {
    id: "diaochan",
    prompt:
      "真实摄影风格的东亚女性头像，二十多岁，精致美妆，高情商社交感，古风优雅气质，皮肤细腻，妆容高级，肩颈以上近景，柔和补光，适合社交 App 头像，不要文字，不要水印。",
  },
  {
    id: "huatuo",
    prompt:
      "真实摄影风格的东亚男性头像，四十岁上下，沉稳克制，医者气质，古风中式长袍，神情温和清醒，肩颈以上近景，自然柔光，适合社交 App 头像，不要文字，不要水印。",
  },
  {
    id: "wuzetian",
    prompt:
      "真实摄影风格的东亚女性头像，三十多岁，强势果断、掌控感强，华贵古风气质，眼神坚定，肩颈以上近景，高级感灯光，适合社交 App 头像，不要文字，不要水印。",
  },
  {
    id: "liqingzhao",
    prompt:
      "真实摄影风格的东亚女性头像，二十多岁，细腻温柔、文艺感强，古风雅致气质，神情克制柔和，肩颈以上近景，浅色柔光，适合社交 App 头像，不要文字，不要水印。",
  },
  {
    id: "direnjie",
    prompt:
      "真实摄影风格的东亚男性头像，四十岁上下，冷静理性，善于观察与推理，古风官员气质，肩颈以上近景，沉稳电影感灯光，适合社交 App 头像，不要文字，不要水印。",
  },
  {
    id: "sushi",
    prompt:
      "真实摄影风格的东亚男性头像，三十多岁，豁达治愈、生活感强，古风文人气质，轻松温暖笑意，肩颈以上近景，暖色自然光，适合社交 App 头像，不要文字，不要水印。",
  },
];

async function generateAvatar(avatar) {
  const response = await fetch(IMAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${IMAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: avatar.prompt,
      aspect_ratio: "1:1",
      response_format: "url",
      n: 1,
      prompt_optimizer: true,
      aigc_watermark: false,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.base_resp?.status_msg || data?.message || `生成失败(${response.status})`);
  }

  const imageUrl = data?.data?.[0]?.url || data?.data?.image_urls?.[0];
  if (!imageUrl) {
    throw new Error(`未拿到 ${avatar.id} 的图片 URL`);
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`下载 ${avatar.id} 头像失败(${imageRes.status})`);
  }

  const arrayBuffer = await imageRes.arrayBuffer();
  const filePath = path.join(outputDir, `${avatar.id}.jpg`);
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  console.log(`saved: ${filePath}`);
}

for (const avatar of avatars) {
  // 串行生成，降低触发限流的概率
  // eslint-disable-next-line no-await-in-loop
  await generateAvatar(avatar);
}

console.log("done");
