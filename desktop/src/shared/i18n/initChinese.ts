import { TRANSLATION_MAP } from "./chineseTranslations";

/**
 * 翻译文本函数
 */
export function t(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  if (TRANSLATION_MAP[trimmed]) {
    // 保持前后空格
    const leadingSpaces = text.match(/^\s*/)?.[0] || "";
    const trailingSpaces = text.match(/\s*$/)?.[0] || "";
    return `${leadingSpaces}${TRANSLATION_MAP[trimmed]}${trailingSpaces}`;
  }
  return text;
}

const IGNORE_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

/**
 * 判断是否属于需要保护的敏感或动态用户生成内容（不进行盲目翻译）
 */
function isUserContentOrKey(text: string): boolean {
  if (!text || text.length > 300) return true;
  // Nostr 密钥 (npub1, nsec1, note1 等)
  if (/^(npub1|nsec1|note1|nevent1|naddr1|nprofile1)[a-z0-9]+$/i.test(text.trim())) {
    return true;
  }
  // 64 位十六进制公私钥/哈希
  if (/^[0-9a-fA-F]{64}$/.test(text.trim())) {
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

    // 翻译 input / textarea placeholder
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && TRANSLATION_MAP[placeholder.trim()]) {
      el.setAttribute("placeholder", t(placeholder));
    }

    // 翻译 title 和 aria-label
    const title = el.getAttribute("title");
    if (title && TRANSLATION_MAP[title.trim()]) {
      el.setAttribute("title", t(title));
    }

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && TRANSLATION_MAP[ariaLabel.trim()]) {
      el.setAttribute("aria-label", t(ariaLabel));
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

  // 3. 监听动态 DOM 变化（React 渲染、弹窗、气泡提示等）
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          translateNode(node);
        });
      } else if (mutation.type === "characterData") {
        if (mutation.target.nodeType === Node.TEXT_NODE) {
          const original = mutation.target.textContent || "";
          const translated = t(original);
          if (translated !== original) {
            mutation.target.textContent = translated;
          }
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  console.log("[Buzz i18n] 简体中文汉化包已成功加载生效！");
}
