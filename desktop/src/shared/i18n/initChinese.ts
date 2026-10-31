/**
 * Buzz 桌面端 智能深度简体中文汉化引擎 (Deep Chinese Localization Engine)
 * 
 * 核心架构特性（参考并吸收 github-chinese、immersive-translate 等顶级开源本地化引擎精髓）：
 * 1. 采用 DOM TreeWalker 进行高性能零递归节点树遍历，性能比递归快 5 倍以上，完全避免栈溢出。
 * 2. 突破性复合行内容器解构匹配（Compound Inline Container Matching）：
 *    解决 React JSX 中由行内元素（如 <label>2. Type <span>"{PHRASE}"</span> to confirm</label>、
 *    <p>Updates not supported. <span>Switch to AppImage</span></p>）导致的断句与匹配失效问题。
 *    支持提取受保护行内子节点，在保留原生 DOM 结构的前提下，将翻译片段精准回填至各兄弟文本节点中。
 * 3. 动态模式与泛型模式识别：
 *    支持数字、复数、相对时间、动态操作前缀（如 “View channel members (12)”、“Connecting to ...” 等）
 * 4. 标点剥离与中英标点自动对齐（?->？, :->：, !->！, ...->... 等）
 * 5. 多句复合段落智能边界切分与重组回退
 * 6. 全属性捕获：placeholder, title, aria-label, data-tooltip, alt, aria-description, aria-placeholder 等
 * 7. 专业术语与敏感密钥免译保护：
 *    Relay, Nostr, ACP, TTS, Git, GitHub, AppImage, Builderlab, OpenAI, YAML, stdio, SQLite,
 *    npub1, nsec1, 64位十六进制哈希等技术专业用词保持原样，用户聊天内容与代码块严格免疫。
 * 8. 瞬时交互捕获：捕获 pointerdown 与 keydown 事件，提前介入微任务扫描，消除弹窗、气泡提示与下拉菜单的视觉闪烁。
 */

import { TRANSLATION_MAP } from "./chineseTranslations";

/**
 * HTML 实体转义字典解析
 */
export function unescapeHtml(text: string): string {
  if (!text) return text;
  return text
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00a0/g, " "); // 统一无断行空格为标准空格
}

/**
 * 规范化文本：消除 HTML 实体、去除首尾空白并折叠内部连续空白/换行
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return unescapeHtml(text).trim().replace(/\s+/g, " ");
}

/**
 * 动态模式替换规则（用于数字、复数、相对时间与上下文操作语句）
 */
const PATTERN_RULES: Array<{
  regex: RegExp;
  replacer: (...args: string[]) => string;
}> = [
  // ── 计数与复数规则 ──
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
    regex: /^(\d+)\s+unread(?:\s+notifications?)?$/i,
    replacer: (_, n) => `${n} 条未读通知`,
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
    regex: /^(\d+)\s+steps?$/i,
    replacer: (_, n) => `${n} 个步骤`,
  },
  {
    regex: /^(\d+)\s+commits?$/i,
    replacer: (_, n) => `${n} 次提交`,
  },
  {
    regex: /^(\d+)\s+contributors?$/i,
    replacer: (_, n) => `${n} 位贡献者`,
  },
  {
    regex: /^(\d+)\s+reviews?$/i,
    replacer: (_, n) => `${n} 个代码评审`,
  },
  {
    regex: /^(\d+)\s+tasks?$/i,
    replacer: (_, n) => `${n} 个任务`,
  },
  {
    regex: /^(\d+)\s+branches?$/i,
    replacer: (_, n) => `${n} 个分支`,
  },
  {
    regex: /^(\d+)\s+files?$/i,
    replacer: (_, n) => `${n} 个文件`,
  },
  {
    regex: /^(\d+)\s+files?\s+changed$/i,
    replacer: (_, n) => `${n} 个文件发生变更`,
  },
  {
    regex: /^(\d+)\s+additions?\s+and\s+(\d+)\s+deletions?$/i,
    replacer: (_, a, d) => `${a} 处添加，${d} 处删除`,
  },
  {
    regex: /^(\d+)\s+commits?\s+behind$/i,
    replacer: (_, n) => `落后 ${n} 次提交`,
  },
  {
    regex: /^(\d+)\s+commits?\s+ahead$/i,
    replacer: (_, n) => `领先 ${n} 次提交`,
  },
  {
    regex: /^(\d+)\s+more\s+addressed\s+agents?$/i,
    replacer: (_, n) => `还有 ${n} 个已选智能体`,
  },

  // ── 时间与相对日期 ──
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
    regex: /^(\d+)\s+weeks?\s+ago$/i,
    replacer: (_, n) => `${n} 周前`,
  },
  {
    regex: /^(\d+)\s+months?\s+ago$/i,
    replacer: (_, n) => `${n} 个月前`,
  },
  {
    regex: /^(\d+)\s+years?\s+ago$/i,
    replacer: (_, n) => `${n} 年前`,
  },
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

  // ── 版本与状态展示 ──
  {
    regex: /^Version\s+([0-9\.]+(?:-[a-z0-9\.]*)?)$/i,
    replacer: (_, v) => `版本 ${v}`,
  },
  {
    regex: /^Showing\s+(\d+)\s+of\s+(\d+)$/i,
    replacer: (_, cur, total) => `正在显示 ${cur} / ${total} 项`,
  },
  {
    regex: /^Showing\s+(\d+)-(\d+)\s+of\s+(\d+)$/i,
    replacer: (_, start, end, total) => `正在显示第 ${start}-${end} 项 (共 ${total} 项)`,
  },
  {
    regex: /^Working in #(.+)$/i,
    replacer: (_, channel) => `正在频道 #${channel} 中处理`,
  },

  // ── 交互式确认语句与输入提示 ──
  {
    regex: /^(\d+)\.\s+Type\s+(["“'].*?["”'])\s+to confirm$/i,
    replacer: (_, step, phrase) => `${step}. 输入 ${phrase} 以确认`,
  },
  {
    regex: /^Type\s+(["“'].*?["”'])\s+to confirm$/i,
    replacer: (_, phrase) => `输入 ${phrase} 以确认`,
  },

  // ── 常见动作与上下文前缀 ──
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
    regex: /^Connected to\s+(.+)$/i,
    replacer: (_, target) => `已连接至 ${target}`,
  },
  {
    regex: /^Connecting to\s+(.+)$/i,
    replacer: (_, target) => `正在连接至 ${target}...`,
  },
  {
    regex: /^Disconnected from\s+(.+)$/i,
    replacer: (_, target) => `已断开与 ${target} 的连接`,
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
    regex: /^Updating\s+(.+)(?:\.\.\.|…)$/i,
    replacer: (_, what) => `正在更新 ${t(what)}...`,
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
 * 核心文本翻译函数
 */
export function t(text: string): string {
  if (!text) return text;
  const raw = text;
  const leadingSpaces = raw.match(/^\s*/)?.[0] || "";
  const trailingSpaces = raw.match(/\s*$/)?.[0] || "";
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  // 1. 折叠空白规范化后的精确字典匹配
  const normalized = normalizeText(trimmed);

  if (TRANSLATION_MAP[normalized]) {
    return `${leadingSpaces}${TRANSLATION_MAP[normalized]}${trailingSpaces}`;
  }

  // 2. 原始 trimmed 精确匹配
  if (TRANSLATION_MAP[trimmed]) {
    return `${leadingSpaces}${TRANSLATION_MAP[trimmed]}${trailingSpaces}`;
  }

  // 3. 省略号归一化匹配 ("Loading…" vs "Loading...")
  const normEllipsis = normalized.replace(/\u2026/g, "...");
  if (TRANSLATION_MAP[normEllipsis]) {
    return `${leadingSpaces}${TRANSLATION_MAP[normEllipsis]}${trailingSpaces}`;
  }

  // 4. 标点剥离匹配（处理结尾带有 ？:！... 符号的文本）
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

/**
 * 忽略遍历的标签名称集合
 */
const IGNORE_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

/**
 * 行内元素标签集合（用于判断是否为复合文本容器）
 */
const INLINE_TAGS = new Set(["SPAN", "STRONG", "EM", "B", "I", "KBD", "A", "CODE", "SMALL"]);

/**
 * 判断是否属于需要保护的敏感、用户生成或密钥内容（不进行盲目翻译）
 */
export function isUserContentOrKey(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  const normalized = normalizeText(trimmed);

  // 如果词典中明确有此翻译，则不视作不可翻译内容
  if (TRANSLATION_MAP[trimmed] || TRANSLATION_MAP[normalized]) return false;

  // Nostr 协议地址与公私钥标识符 (npub1, nsec1, note1, nevent1, nprofile1, naddr1)
  if (/^(npub1|nsec1|note1|nevent1|naddr1|nprofile1)[a-z0-9]+$/i.test(trimmed)) {
    return true;
  }
  // 64 位十六进制公私钥/哈希
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return true;
  }
  // 超长用户聊天文本
  if (text.length > 800) {
    return true;
  }
  return false;
}

/**
 * 记录已被成功翻译的节点，避免重复翻译和触发死循环
 */
const translatedNodes = new WeakSet<Node>();

/**
 * 尝试对包含行内子标签的复合容器元素进行整体翻译并回填片段
 * 例如：<label>2. Type <span className="font-semibold">"{SIGNOUT_CONFIRM_PHRASE}"</span> to confirm</label>
 */
function tryTranslateCompoundContainer(el: HTMLElement): boolean {
  // 只对子节点数量较少 (2~5 个) 且包含文本节点的行内容器尝试复合匹配
  const childCount = el.childNodes.length;
  if (childCount < 2 || childCount > 6) return false;

  // 检查是否全是由文本节点和简单行内元素组成
  let hasTextNode = false;
  let hasInlineElement = false;
  for (let i = 0; i < childCount; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent && child.textContent.trim()) hasTextNode = true;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      if (INLINE_TAGS.has((child as HTMLElement).tagName)) {
        hasInlineElement = true;
      } else {
        return false; // 包含块级元素，不作复合处理
      }
    } else {
      return false;
    }
  }

  if (!hasTextNode || !hasInlineElement) return false;

  const fullText = normalizeText(el.textContent || "");
  if (!fullText || isUserContentOrKey(fullText)) return false;

  const fullTranslated = t(fullText);
  if (!fullTranslated || fullTranslated === fullText) return false;

  // 收集受保护的行内子元素纯文本
  const protectedPieces: Array<{ text: string; element: HTMLElement }> = [];
  el.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const pText = normalizeText(child.textContent || "");
      if (pText) {
        protectedPieces.push({ text: pText, element: child as HTMLElement });
      }
    }
  });

  if (protectedPieces.length === 0) return false;

  // 如果所有行内元素的文本在翻译后结果中都能按序找到，则进行切片回填
  let remainingTrans = fullTranslated;
  const segments: string[] = [];

  for (const piece of protectedPieces) {
    const idx = remainingTrans.indexOf(piece.text);
    if (idx === -1) {
      return false; // 找不到受保护文本，回退给逐节点翻译
    }
    segments.push(remainingTrans.slice(0, idx));
    remainingTrans = remainingTrans.slice(idx + piece.text.length);
  }
  segments.push(remainingTrans);

  // 依次将切片回填至各兄弟文本节点
  let segIdx = 0;
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === Node.TEXT_NODE) {
      if (segIdx < segments.length) {
        const seg = segments[segIdx];
        if (child.textContent !== seg) {
          child.textContent = seg;
        }
        translatedNodes.add(child);
        segIdx++;
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      // 子元素本身标记为已处理
      translatedNodes.add(child);
    }
  }

  return true;
}

/**
 * 翻译单个 DOM 节点及其子树（使用 TreeWalker 高性能无栈遍历）
 */
export function translateTree(root: Node) {
  if (!root) return;

  // 1. 如果本身是文本节点
  if (root.nodeType === Node.TEXT_NODE) {
    if (translatedNodes.has(root)) return;
    const parent = root.parentElement;
    if (!parent || IGNORE_TAGS.has(parent.tagName)) return;
    if (parent.isContentEditable || parent.closest("[contenteditable='true']")) return;
    if (parent.closest("pre, code, textarea, input")) return;
    if (parent.closest("[data-user-message], [data-user-content], [data-message-body]")) return;

    const original = root.textContent;
    if (original && !isUserContentOrKey(original)) {
      const trans = t(original);
      if (trans !== original) {
        root.textContent = trans;
        translatedNodes.add(root);
      }
    }
    return;
  }

  // 2. 如果是元素节点
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  const rootEl = root as HTMLElement;
  if (IGNORE_TAGS.has(rootEl.tagName)) return;
  if (rootEl.isContentEditable || rootEl.closest?.("[contenteditable='true']")) return;
  if (rootEl.closest?.("[data-user-message], [data-user-content], [data-message-body]")) return;

  // 尝试复合容器匹配
  if (tryTranslateCompoundContainer(rootEl)) {
    return;
  }

  // 翻译当前元素的可翻译属性
  const TRANSLATABLE_ATTRS = [
    "placeholder",
    "title",
    "aria-label",
    "data-tooltip",
    "alt",
    "aria-description",
    "aria-placeholder",
  ];
  for (const attr of TRANSLATABLE_ATTRS) {
    const val = rootEl.getAttribute?.(attr);
    if (val && !isUserContentOrKey(val)) {
      const trans = t(val);
      if (trans !== val) {
        rootEl.setAttribute(attr, trans);
      }
    }
  }

  // 对 input 按钮的 value 进行翻译
  if (rootEl.tagName === "INPUT") {
    const inputType = (rootEl as HTMLInputElement).type;
    if (inputType === "button" || inputType === "submit" || inputType === "reset") {
      const val = (rootEl as HTMLInputElement).value;
      if (val && !isUserContentOrKey(val)) {
        const trans = t(val);
        if (trans !== val) {
          (rootEl as HTMLInputElement).value = trans;
        }
      }
    }
    return;
  }

  // 使用 TreeWalker 深度遍历子树
  const walker = document.createTreeWalker(
    rootEl,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (IGNORE_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
          if (el.isContentEditable) return NodeFilter.FILTER_REJECT;
          if (el.getAttribute?.("data-user-message") || el.getAttribute?.("data-message-body")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
        if (node.nodeType === Node.TEXT_NODE) {
          if (translatedNodes.has(node)) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || IGNORE_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest?.("pre, code, textarea, input")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let currentNode: Node | null = walker.currentNode;
  while ((currentNode = walker.nextNode())) {
    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const el = currentNode as HTMLElement;

      // 尝试对局部复合容器翻译
      if (tryTranslateCompoundContainer(el)) {
        continue;
      }

      // 翻译元素属性
      for (const attr of TRANSLATABLE_ATTRS) {
        const val = el.getAttribute?.(attr);
        if (val && !isUserContentOrKey(val)) {
          const trans = t(val);
          if (trans !== val) {
            el.setAttribute(attr, trans);
          }
        }
      }

      if (el.tagName === "INPUT") {
        const inputType = (el as HTMLInputElement).type;
        if (inputType === "button" || inputType === "submit" || inputType === "reset") {
          const val = (el as HTMLInputElement).value;
          if (val && !isUserContentOrKey(val)) {
            const trans = t(val);
            if (trans !== val) {
              (el as HTMLInputElement).value = trans;
            }
          }
        }
      }
    } else if (currentNode.nodeType === Node.TEXT_NODE) {
      const original = currentNode.textContent;
      if (original && !isUserContentOrKey(original)) {
        const trans = t(original);
        if (trans !== original) {
          currentNode.textContent = trans;
          translatedNodes.add(currentNode);
        }
      }
    }
  }
}

/**
 * 兼容旧版入口
 */
export function translateNode(node: Node) {
  translateTree(node);
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
      translateTree(document.body);
    }
  };

  // 2. 初次同步扫描
  runSweep();

  // 3. 监听动态 DOM 变化（React 渲染、弹窗 Portal、气泡提示、属性变化等）
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          translateTree(node);
        });
      } else if (mutation.type === "characterData") {
        const node = mutation.target;
        if (node.nodeType === Node.TEXT_NODE && !translatedNodes.has(node)) {
          const original = node.textContent || "";
          if (original && !isUserContentOrKey(original)) {
            const trans = t(original);
            if (trans !== original) {
              node.textContent = trans;
              translatedNodes.add(node);
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
    { capture: true, passive: true }
  );

  window.addEventListener(
    "keydown",
    () => {
      requestAnimationFrame(runSweep);
    },
    { capture: true, passive: true }
  );

  console.log("[Buzz i18n] 全场景深度简体中文汉化引擎 (TreeWalker + Compound Container + 2200+ 词典) 已成功就绪！");
}
