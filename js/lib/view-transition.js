/**
 * View Transitions API（対応ブラウザのみ）
 * @param {() => void} updateDom
 */
export function withViewTransition(updateDom) {
  if (typeof updateDom !== "function") return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !document.startViewTransition) {
    updateDom();
    return;
  }
  document.startViewTransition(() => {
    updateDom();
  });
}

/**
 * クリック元カードとモーダルに一時的な transition name を付与
 * @param {HTMLElement | null} source
 * @param {HTMLElement | null} dialog
 */
export function tagViewTransitionPair(source, dialog) {
  if (!source || !dialog) return () => {};
  const prevSource = source.style.viewTransitionName;
  const prevDialog = dialog.style.viewTransitionName;
  source.style.viewTransitionName = "vt-source";
  dialog.style.viewTransitionName = "vt-dialog";
  return () => {
    source.style.viewTransitionName = prevSource;
    dialog.style.viewTransitionName = prevDialog;
  };
}
