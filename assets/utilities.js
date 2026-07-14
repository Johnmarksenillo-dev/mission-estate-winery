/**
 * Request an idle callback or fallback to setTimeout
 * @returns {function} The requestIdleCallback function
 */
export const requestIdleCallback =
  typeof window.requestIdleCallback == 'function'
    ? window.requestIdleCallback
    : setTimeout;

/**
 * Creates a debounced function that delays calling the provided function (fn)
 * until after wait milliseconds have elapsed since the last time
 * the debounced function was invoked. The returned function has a .cancel()
 * method to cancel any pending calls.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn The function to debounce
 * @param {number} wait The time (in milliseconds) to wait before calling fn
 * @returns {T & { cancel(): void }} A debounced version of fn with a .cancel() method
 */
export function debounce(fn, wait) {
  /** @type {number | undefined} */
  let timeout;

  /** @param {...any} args */
  function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  }

  // Add the .cancel method:
  debounced.cancel = () => {
    clearTimeout(timeout);
  };

  return /** @type {T & { cancel(): void }} */ (debounced);
}

/**
 * Wait for all animations to finish before calling the callback.
 * @param {Element | Element[]} elements The element(s) whose animations to wait for.
 * @param {() => void} [callback] The function to call when all animations are finished.
 * @param {Object} [options] The options to pass to `Element.getAnimations`.
 * @returns {Promise<void>} A promise that resolves when all animations are finished.
 */
export function onAnimationEnd(
  elements,
  callback,
  options = { subtree: true }
) {
  const animations = Array.isArray(elements)
    ? elements.flatMap((element) => element.getAnimations(options))
    : elements.getAnimations(options);
  const animationPromises = animations.reduce((acc, animation) => {
    // Ignore ViewTimeline animations
    if (animation.timeline instanceof DocumentTimeline) {
      acc.push(animation.finished);
    }

    return acc;
  }, /** @type {Promise<Animation>[]} */ ([]));

  return Promise.allSettled(animationPromises).then(callback);
}

/**
 * Check if the click is outside the element.
 * @param {MouseEvent} event The mouse event.
 * @param {Element} element The element to check.
 * @returns {boolean} True if the click is outside the element, false otherwise.
 */
export function isClickedOutside(event, element) {
  if (
    event.target instanceof HTMLDialogElement ||
    !(event.target instanceof Element)
  ) {
    return !isPointWithinElement(event.clientX, event.clientY, element);
  }

  return !element.contains(event.target);
}

/**
 * A media query for large screens
 * @type {MediaQueryList}
 */
export const mediaQueryLarge = window.matchMedia('(min-width: 750px)');

/**
 * Check if the current breakpoint is mobile
 * @returns {boolean} True if the current breakpoint is mobile, false otherwise
 */
export function isMobileBreakpoint() {
  return !mediaQueryLarge.matches;
}
