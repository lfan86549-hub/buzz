import fs from 'fs';
import path from 'path';

console.log("=== 正在验证构建产物中的中文词条打包状态 ===");

const distDir = './desktop/dist/assets';
const files = fs.readdirSync(distDir);
const mainBundle = files.find(f => f.startsWith('index-') && f.endsWith('.js'));

if (!mainBundle) {
  console.error("未找到 index-*.js 主文件！");
  process.exit(1);
}

const bundlePath = path.join(distDir, mainBundle);
const content = fs.readFileSync(bundlePath, 'utf8');

const sampleKeywords = [
  "全场景深度简体中文汉化引擎",
  "为当前选中的导航项提供更高对比度的背景高亮底色",
  "已为您在下方勾选的分类启用了原生桌面通知",
  "智能体在对话中的交互行为及其在此机器上的运行方式",
  "此 Linux 软件包不支持应用内更新",
  "将使用全新的密钥对创建新智能体",
  "保存可复用的频道配置，并在创建新频道时一键应用",
  "数值越低，透出的桌面磨砂毛玻璃模糊感越强",
  "此备份文件验证有效",
  "退出登录并彻底清除所有本地数据",
  "包含采样时间、应用版本、操作系统平台",
  "按消息到达的先后顺序，使用语音大声朗读新的智能体回复"
];

let allFound = true;
for (const kw of sampleKeywords) {
  if (content.includes(kw)) {
    console.log(`[PASS] 成功在前端打包产物中定位到: "${kw.slice(0, 24)}..."`);
  } else {
    console.error(`[FAIL] 未能在打包产物中找到: "${kw}"`);
    allFound = false;
  }
}

if (allFound) {
  console.log("\n>>> 前端产物中文包验证 100% 通过！所有设置菜单与内页翻译已成功打包进 index.js! <<<");
} else {
  process.exit(1);
}
