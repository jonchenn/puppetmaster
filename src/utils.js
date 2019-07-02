/*
 * An enhanced querySelector that supports shadow dom piercing.
 * Usage:
 *   querySelectorShadowDom([Selector String]);
 *
 * Examples:
 *   // Find the target element insides a webcomponent's shadow dom.
 *   querySelectorShadowDom('body webcomponent::shadowRoot target-el');
 *
 *   // Find the target element insides nested shadow doms.
 *   querySelectorShadowDom('body webcomponent::shadowRoot another-component::shadowRoot target-el');
 *
 * For extending prototypes in Browser
 */
const querySelectorShadowDom = function(rootElement, selectors) {
  if (typeof(selectors) !== 'string') {
    throw 'Parameter selectors is not a string';
  }
  let currentElement = rootElement;
  let selectorPaths = selectors.split('::shadowRoot');

  for (let [index, s] of selectorPaths.entries()) {
    if (index > 0) {
      currentElement = currentElement.shadowRoot;
    }
    if (currentElement) {
      currentElement = s ? currentElement.querySelector(s) : currentElement;
    }
    if (index < selectorPaths.length - 1 && !currentElement) {
      return null;
    }
  }
  return currentElement;
};

const extendPrototypes = function() {
  Element.prototype.querySelectorShadowDom = function(selectors) {
    return querySelectorShadowDom(this, selectors);
  };

  Document.prototype.querySelectorShadowDom = function(selectors) {
    return querySelectorShadowDom(this, selectors);
  };
}

module.exports = {
  'querySelectorShadowDom': querySelectorShadowDom,
};
