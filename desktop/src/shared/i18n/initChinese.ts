/**
 * Buzz 桌面端 智能深度简体中文汉化引擎
 * 
 * 核心特性：
 * 1. 智能空白与换行归一化：自动折叠 JSX 多行换行与缩进空格，解决 React/Prettier 格式化导致的文本匹配失效问题
 * 2. HTML 实体智能解析：自动处理 &apos;, &quot;, &amp; 等实体字符
 * 3. 智能标点与句式剥离：自动中英文标点映射（?->？, :->：, !->！, ...->...）
 * 4. 多句段落拆解回退：对长描述文本按句子边界拆分翻译并重组
 * 5. 正则动态模式推导：自动处理数字、复数、相对时间与前缀动词
 * 6. Portal 与动态弹窗瞬时捕获：覆盖 Radix UI 动态挂载的弹窗、气泡提示与下拉菜单
 * 7. 敏感与用户数据保护：严格保护 Nostr 公私钥 (nsec1/npub1)、64位十六进制哈希、用户聊天内容与代码块
 */

import { TRANSLATION_MAP } from "./chineseTranslations";

/**
 * HTML 实体转义字典
 */
function unescapeHtml(text: string): string {
  if (!text) return text;
  return text
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * 规范化文本：去除外层空白并将内部多余空格/换行折叠为单个空格
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return unescapeHtml(text).trim().replace(/\s+/g, " ");
}

/**
 * 动态模式替换规则（用于数字、复数、相对时间与组合语句）
 */
const PATTERN_RULES: Array<{
  regex: RegExp;
  replacer: (...args: string[]) => string;
}> = [
  // 计数与复数
  {
    regex: /^(\d+)\s+repl(?:y|ies)$/i,
    replacer: (_, n) => `${n} 条回复`,
  },
  {
    regex: /^(\d+)\s+members?$/i,
    replacer: (_, n) => `${n} 位成员`,
  },
  {
    regex: /^(\d+)\s+agents?$/i,
    replacer: (_, n) => `${n} 个智能体`,
  },
  {
    regex: /^(\d+)\s+projects?$/i,
    replacer: (_, n) => `${n} 个项目`,
  },
  {
    regex: /^(\d+)\s+channels?$/i,
    replacer: (_, n) => `${n} 个频道`,
  },
  {
    regex: /^(\d+)\s+teams?$/i,
    replacer: (_, n) => `${n} 个团队`,
  },
  {
    regex: /^(\d+)\s+unreads?$/i,
    replacer: (_, n) => `${n} 条未读`,
  },
  {
    regex: /^(\d+)\s+items?$/i,
    replacer: (_, n) => `${n} 项`,
  },
  {
    regex: /^(\d+)\s+runs?$/i,
    replacer: (_, n) => `${n} 次运行`,
  },
  {
    regex: /^(\d+)\s+step(?:s)?$/i,
    replacer: (_, n) => `${n} 个步骤`,
  },
  {
    regex: /^(\d+)\s+seconds?$/i,
    replacer: (_, n) => `${n} 秒`,
  },
  {
    regex: /^(\d+)\s+minutes?$/i,
    replacer: (_, n) => `${n} 分钟`,
  },
  {
    regex: /^(\d+)\s+hours?$/i,
    replacer: (_, n) => `${n} 小时`,
  },
  {
    regex: /^(\d+)\s+days?$/i,
    replacer: (_, n) => `${n} 天`,
  },
  {
    regex: /^(\d+)\s+seconds?\s+ago$/i,
    replacer: (_, n) => `${n} 秒前`,
  },
  {
    regex: /^(\d+)\s+minutes?\s+ago$/i,
    replacer: (_, n) => `${n} 分钟前`,
  },
  {
    regex: /^(\d+)\s+hours?\s+ago$/i,
    replacer: (_, n) => `${n} 小时前`,
  },
  {
    regex: /^(\d+)\s+days?\s+ago$/i,
    replacer: (_, n) => `${n} 天前`,
  },
  {
    regex: /^(\d+)\s+more\s+addressed\s+agents?$/i,
    replacer: (_, n) => `还有 ${n} 个已选智能体`,
  },

  // 相对时间与提示
  {
    regex: /^last reply\s+(.+)$/i,
    replacer: (_, time) => `最新回复 ${t(time)}`,
  },
  {
    regex: /^Joined\s+(.+)$/i,
    replacer: (_, time) => `加入于 ${time}`,
  },
  {
    regex: /^Created\s+(.+)$/i,
    replacer: (_, time) => `创建于 ${time}`,
  },
  {
    regex: /^Edited\s+(.+)$/i,
    replacer: (_, time) => `编辑于 ${time}`,
  },
  {
    regex: /^Today at\s+(.+)$/i,
    replacer: (_, time) => `今天 ${time}`,
  },
  {
    regex: /^Yesterday at\s+(.+)$/i,
    replacer: (_, time) => `昨天 ${time}`,
  },

  // 常见动作与上下文前缀
  {
    regex: /^View channel members\s*\((.+)\)$/i,
    replacer: (_, count) => `查看频道成员 (${count})`,
  },
  {
    regex: /^Open profile (?:menu )?for\s+(.+)$/i,
    replacer: (_, name) => `打开 ${name} 的个人资料`,
  },
  {
    regex: /^React with\s+(.+)$/i,
    replacer: (_, emoji) => `回应 ${emoji} 表情`,
  },
  {
    regex: /^Search conversation with\s+(.+)$/i,
    replacer: (_, name) => `在与 ${name} 的对话中搜索`,
  },
  {
    regex: /^Search in\s+(.+)$/i,
    replacer: (_, where) => `在 ${t(where)} 中搜索`,
  },
  {
    regex: /^Search for\s+(.+)$/i,
    replacer: (_, query) => `搜索 ${query}`,
  },
  {
    regex: /^Switch to\s+(.+)$/i,
    replacer: (_, target) => `切换至 ${t(target)}`,
  },
  {
    regex: /^Invite to\s+(.+)$/i,
    replacer: (_, where) => `邀请加入 ${t(where)}`,
  },
  {
    regex: /^Leave\s+(.+)$/i,
    replacer: (_, where) => `退出 ${t(where)}`,
  },
  {
    regex: /^Delete\s+(.+)\?$/i,
    replacer: (_, target) => `删除 ${t(target)}？`,
  },
  {
    regex: /^Remove\s+(.+)\s+search scope$/i,
    replacer: (_, scope) => `清除 ${scope} 搜索范围`,
  },
  {
    regex: /^Loading\s+(.+)(?:\.\.\.|…)$/i,
    replacer: (_, what) => `正在加载 ${t(what)}...`,
  },
  {
    regex: /^Saving\s+(.+)(?:\.\.\.|…)$/i,
    replacer: (_, what) => `正在保存 ${t(what)}...`,
  },
  {
    regex: /^Creating\s+(.+)(?:\.\.\.|…)$/i,
    replacer: (_, what) => `正在创建 ${t(what)}...`,
  },
  {
    regex: /^Connecting\s+(.+)(?:\.\.\.|…)$/i,
    replacer: (_, what) => `正在连接 ${t(what)}...`,
  },
  {
    regex: /^Waiting for\s+(.+)$/i,
    replacer: (_, what) => `正在等待 ${t(what)}...`,
  },
  {
    regex: /^No (?:messages|matches) for\s+(.+)$/i,
    replacer: (_, query) => `未找到关于 ${query} 的匹配项`,
  },
];

/**
 * 核心翻译函数
 */
export function t(text: string): string {
  if (!text) return text;
  const raw = text;
  const leadingSpaces = raw.match(/^\s*/)?.[0] || "";
  const trailingSpaces = raw.match(/\s*$/)?.[0] || "";
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  // 1. 折叠空白规范化匹配
  const normalized = normalizeText(trimmed);

  if (TRANSLATION_MAP[normalized]) {
    return `${leadingSpaces}${TRANSLATION_MAP[normalized]}${trailingSpaces}`;
  }

  // 2. 原始 trimmed 精确匹配（保留某些特殊格式）
  if (TRANSLATION_MAP[trimmed]) {
    return `${leadingSpaces}${TRANSLATION_MAP[trimmed]}${trailingSpaces}`;
  }

  // 3. 省略号归一化匹配 ("Loading…" vs "Loading...")
  const normEllipsis = normalized.replace(/\u2026/g, "...");
  if (TRANSLATION_MAP[normEllipsis]) {
    return `${leadingSpaces}${TRANSLATION_MAP[normEllipsis]}${trailingSpaces}`;
  }

  // 4. 标点剥离匹配
  const punctMatch = normalized.match(/^(.*?)([\?？:：!！\.\u2026]+)$/);
  if (punctMatch) {
    const stem = punctMatch[1].trim();
    const punct = punctMatch[2];
    if (TRANSLATION_MAP[stem]) {
      const cnPunct = punct
        .replace(/\?/g, "？")
        .replace(/:/g, "：")
        .replace(/!/g, "！")
        .replace(/\u2026/g, "...")
        .replace(/\.{3}/g, "...")
        .replace(/\.$/, "。");
      return `${leadingSpaces}${TRANSLATION_MAP[stem]}${cnPunct}${trailingSpaces}`;
    }
  }

  // 5. 括号与引号包裹匹配
  const parenMatch = normalized.match(/^\((.*?)\)$/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    if (TRANSLATION_MAP[inner]) {
      return `${leadingSpaces}（${TRANSLATION_MAP[inner]}）${trailingSpaces}`;
    }
  }
  const quoteMatch = normalized.match(/^["“'](.*?)["”']$/);
  if (quoteMatch) {
    const inner = quoteMatch[1].trim();
    if (TRANSLATION_MAP[inner]) {
      return `${leadingSpaces}“${TRANSLATION_MAP[inner]}”${trailingSpaces}`;
    }
  }

  // 6. 动态正则模式规则匹配
  for (const { regex, replacer } of PATTERN_RULES) {
    if (regex.test(normalized)) {
      return `${leadingSpaces}${normalized.replace(regex, replacer)}${trailingSpaces}`;
    }
  }

  // 7. 多句段落拆解回退：若文本包含多句，按标点边界拆分并尝试逐句翻译
  if (/[.!?。！？]\s+[A-Z]/.test(normalized)) {
    const parts = normalized.split(/(?<=[.!?。！？])\s+(?=[A-Z])/);
    if (parts.length > 1) {
      let anyTranslated = false;
      const translatedParts = parts.map((part) => {
        const trans = t(part);
        if (trans !== part) {
          anyTranslated = true;
          return trans;
        }
        return part;
      });
      if (anyTranslated) {
        return `${leadingSpaces}${translatedParts.join(" ")}${trailingSpaces}`;
      }
    }
  }

  return raw;
}

const IGNORE_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

/**
 * 判断是否属于需要保护的敏感、用户生成或密钥内容（不进行盲目翻译）
 */
export function isUserContentOrKey(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  const normalized = normalizeText(trimmed);

  // 如果词典中明确有此翻译，则不视作不可翻译内容
  if (TRANSLATION_MAP[trimmed] || TRANSLATION_MAP[normalized]) return false;

  // Nostr 密钥 (npub1, nsec1, note1, nevent1, nprofile1, naddr1)
  if (/^(npub1|nsec1|note1|nevent1|naddr1|nprofile1)[a-z0-9]+$/i.test(trimmed)) {
    return true;
  }
  // 64 位十六进制公私钥/哈希
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return true;
  }
  // 超长用户聊天文本
  if (text.length > 600) {
    return true;
  }
  return false;
}

/**
 * 翻译单个 DOM 节点
 */
export function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || IGNORE_TAGS.has(parent.tagName)) return;
    if (parent.isContentEditable || parent.closest("[contenteditable='true']")) return;
    if (parent.closest("pre, code, textarea, input")) return;
    if (parent.closest("[data-user-message], [data-user-content], [data-message-body]")) return;

    const originalText = node.textContent;
    if (originalText && !isUserContentOrKey(originalText)) {
      const translated = t(originalText);
      if (translated !== originalText) {
        node.textContent = translated;
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    if (IGNORE_TAGS.has(el.tagName)) return;

    // 翻译常见属性
    const attrs = [
      "placeholder",
      "title",
      "aria-label",
      "data-tooltip",
      "alt",
      "aria-description",
      "aria-placeholder",
    ];
    for (const attr of attrs) {
      const val = el.getAttribute(attr);
      if (val && !isUserContentOrKey(val)) {
        const translated = t(val);
        if (translated !== val) {
          el.setAttribute(attr, translated);
        }
      }
    }

    // 递归遍历子节点
    for (let i = 0; i < el.childNodes.length; i++) {
      translateNode(el.childNodes[i]);
    }
  }
}

/**
 * 初始化全局汉化拦截器
 */
export function initChineseLocalization() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // 1. 设置网页标题与语言
  document.documentElement.lang = "zh-CN";
  if (!document.title || document.title === "Buzz") {
    document.title = "Buzz 蜂巢";
  }

  const runSweep = () => {
    if (document.body) {
      translateNode(document.body);
    }
  };

  // 2. 初次同步扫描
  runSweep();

  // 3. 监听动态 DOM 变化（React 渲染、弹窗 Portal、气泡提示、属性变化等）
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          translateNode(node);
        });
      } else if (mutation.type === "characterData") {
        if (mutation.target.nodeType === Node.TEXT_NODE) {
          const original = mutation.target.textContent || "";
          if (original && !isUserContentOrKey(original)) {
            const translated = t(original);
            if (translated !== original) {
              mutation.target.textContent = translated;
            }
          }
        }
      } else if (mutation.type === "attributes") {
        const el = mutation.target as HTMLElement;
        const attrName = mutation.attributeName;
        if (attrName && el.getAttribute) {
          const val = el.getAttribute(attrName);
          if (val && !isUserContentOrKey(val)) {
            const trans = t(val);
            if (trans !== val) {
              el.setAttribute(attrName, trans);
            }
          }
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "placeholder",
      "title",
      "aria-label",
      "data-tooltip",
      "alt",
      "aria-description",
      "aria-placeholder",
    ],
  });

  // 4. 捕获阶段交互监听：当用户点击或聚焦打开弹窗/抽屉/下拉菜单时，瞬时触发微任务扫描，彻底消除视觉闪烁
  window.addEventListener(
    "pointerdown",
    () => {
      requestAnimationFrame(runSweep);
    },
    { capture: true, passive: true },
  );

  window.addEventListener(
    "keydown",
    () => {
      requestAnimationFrame(runSweep);
    },
    { capture: true, passive: true },
  );

  console.log("[Buzz i18n] 全场景深度简体中文汉化引擎已成功就绪！");
}
