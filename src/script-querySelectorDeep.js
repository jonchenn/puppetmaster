/*
 * An enhanced querySelector that supports shadow dom piercing.
 * Usage:
 *   querySelectorDeep(element, selectorString);
 *
 * Examples:
 *   // Find the target element insides a webcomponent's shadow dom.
 *   querySelectorDeep(document, 'body webcomponent::shadowRoot target-el');
 *
 *   // Find the target element insides nested shadow doms.
 *   querySelectorDeep(document, 'body webcomponent::shadowRoot another-component::shadowRoot target-el');
 *
 * For extending prototypes in Browser
 */
const querySelectorDeep = function(rootEl, selectors) {
  if (typeof(selectors) !== 'string') {
    throw 'Parameter selectors is not a string';
  }
  let curEl = rootEl;
  let selectorPaths = selectors.split('::shadowRoot');

  for (let [index, selector] of selectorPaths.entries()) {
    if (index > 0) {
      curEl = curEl.shadowRoot;
    }

    if (selector) {
      curEl = (curEl === rootEl ? curEl._querySelector(selector) : curEl.querySelector(selector));
      if (index < selectorPaths.length - 1 && !curEl) {
        return null;
      }
    }
  }
  return curEl;
};

Document.prototype._querySelector = Document.prototype.querySelector;
Document.prototype.querySelector = function(selectors) {
  return querySelectorDeep(this, selectors);
};
