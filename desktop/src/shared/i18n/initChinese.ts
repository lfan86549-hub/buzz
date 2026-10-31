import { TRANSLATION_MAP } from "./chineseTranslations";

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
    replacer: (_, where) => `在 ${where} 中搜索`,
  },
  {
    regex: /^Switch to\s+(.+)$/i,
    replacer: (_, target) => `切换至 ${t(target)}`,
  },
  {
    regex: /^Invite to\s+(.+)$/i,
    replacer: (_, where) => `邀请加入 ${where}`,
  },
  {
    regex: /^Leave\s+(.+)$/i,
    replacer: (_, where) => `退出 ${where}`,
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
    regex: /^No (?:messages|matches) for\s+(.+)$/i,
    replacer: (_, query) => `未找到关于 ${query} 的匹配项`,
  },
];

/**
 * 翻译文本函数
 */
export function t(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  if (!trimmed) return text;

  // 1. 词典精确匹配
  if (TRANSLATION_MAP[trimmed]) {
    const leadingSpaces = text.match(/^\s*/)?.[0] || "";
    const trailingSpaces = text.match(/\s*$/)?.[0] || "";
    return `${leadingSpaces}${TRANSLATION_MAP[trimmed]}${trailingSpaces}`;
  }

  // 2. 省略号与标点归一化匹配 (例如 "Loading…" -> "Loading...", "Delete message?" -> "删除消息？")
  const normalizedEllipsis = trimmed.replace(/\u2026/g, "...");
  if (TRANSLATION_MAP[normalizedEllipsis]) {
    const leadingSpaces = text.match(/^\s*/)?.[0] || "";
    const trailingSpaces = text.match(/\s*$/)?.[0] || "";
    return `${leadingSpaces}${TRANSLATION_MAP[normalizedEllipsis]}${trailingSpaces}`;
  }

  // 标点剥离匹配
  const punctMatch = trimmed.match(/^(.*?)([\?？:：!！\.\u2026]+)$/);
  if (punctMatch) {
    const stem = punctMatch[1].trim();
    const punct = punctMatch[2];
    if (TRANSLATION_MAP[stem]) {
      const cnPunct = punct
        .replace(/\?/g, "？")
        .replace(/:/g, "：")
        .replace(/!/g, "！")
        .replace(/\u2026/g, "...")
        .replace(/\.{3}/g, "...");
      const leadingSpaces = text.match(/^\s*/)?.[0] || "";
      const trailingSpaces = text.match(/\s*$/)?.[0] || "";
      return `${leadingSpaces}${TRANSLATION_MAP[stem]}${cnPunct}${trailingSpaces}`;
    }
  }

  // 3. 动态正则模式规则匹配
  for (const { regex, replacer } of PATTERN_RULES) {
    if (regex.test(trimmed)) {
      const leadingSpaces = text.match(/^\s*/)?.[0] || "";
      const trailingSpaces = text.match(/\s*$/)?.[0] || "";
      return `${leadingSpaces}${trimmed.replace(regex, replacer)}${trailingSpaces}`;
    }
  }

  return text;
}

const IGNORE_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

/**
 * 判断是否属于需要保护的敏感或动态用户生成内容（不进行盲目翻译）
 */
function isUserContentOrKey(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  // 如果词典中明确有此翻译，则不视作用户不可翻译内容
  if (TRANSLATION_MAP[trimmed]) return false;

  // Nostr 密钥 (npub1, nsec1, note1 等)
  if (/^(npub1|nsec1|note1|nevent1|naddr1|nprofile1)[a-z0-9]+$/i.test(trimmed)) {
    return true;
  }
  // 64 位十六进制公私钥/哈希
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return true;
  }
  // 超长用户聊天文本
  if (text.length > 500) {
    return true;
  }
  return false;
}

/**
 * 翻译单个 DOM 节点
 */
function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || IGNORE_TAGS.has(parent.tagName)) return;
    if (parent.isContentEditable || parent.closest("[contenteditable='true']")) return;

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

    // 翻译 placeholder
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && !isUserContentOrKey(placeholder)) {
      const translated = t(placeholder);
      if (translated !== placeholder) {
        el.setAttribute("placeholder", translated);
      }
    }

    // 翻译 title
    const title = el.getAttribute("title");
    if (title && !isUserContentOrKey(title)) {
      const translated = t(title);
      if (translated !== title) {
        el.setAttribute("title", translated);
      }
    }

    // 翻译 aria-label
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && !isUserContentOrKey(ariaLabel)) {
      const translated = t(ariaLabel);
      if (translated !== ariaLabel) {
        el.setAttribute("aria-label", translated);
      }
    }

    // 翻译 data-tooltip
    const dataTooltip = el.getAttribute("data-tooltip");
    if (dataTooltip && !isUserContentOrKey(dataTooltip)) {
      const translated = t(dataTooltip);
      if (translated !== dataTooltip) {
        el.setAttribute("data-tooltip", translated);
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

  // 2. 初次同步扫描
  if (document.body) {
    translateNode(document.body);
  }

  // 3. 监听动态 DOM 变化（React 渲染、弹窗、气泡提示、属性变化等）
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
    attributeFilter: ["placeholder", "title", "aria-label", "data-tooltip"],
  });

  console.log("[Buzz i18n] 深度简体中文汉化引擎已成功就绪！");
}
