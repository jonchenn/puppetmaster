const PuppetMaster = require('../src/core');
const ActionType = PuppetMaster.ActionType;

let task = {
  visits: 1, // Total number of simulated visits.
  flows: [{
    name: 'Flow to a PDP at jonchen-shop.firebaseapp.com',
    percentage: 1, // 100% of users
    isHeadless: false,
    browser: 'chrome',
    device: 'Pixel 2',
    windowWidth: 450,
    windowHeight: 900,
    sleepAfterEachStep: 1000,
    sleepAfterEachAction: 1000,
    outputHtmlToFile: true,
    stopWhenFail: true,
    showConsoleOutput: false,
    userAgent: 'fake-useragent',
    steps: [{
      log: 'Go to sample eCommerce site',
      actions: [{
        actionType: ActionType.URL,
        url: 'http://jonchen-shop.firebaseapp.com',
      }, {
        actionType: ActionType.SLEEP,
        value: 2000,
      }, {
        actionType: ActionType.ASSERT_PAGE_TITLE,
        content: 'Home - SHOP',
      }]
    }, {
      actionType: ActionType.ASSERT_EXIST,
      selector: 'shop-app::shadowRoot shop-home::shadowRoot shop-button',
    }, {
      actionType: ActionType.SCROLL_TO,
      selector: 'shop-app::shadowRoot shop-home::shadowRoot :nth-child(4) > shop-button',
    }, {
      selector: 'shop-app::shadowRoot shop-home::shadowRoot :nth-child(4) > shop-button',
      actionType: ActionType.CLICK,
      // content: 'Shop Now',
      sleepAfter: 2000,
    }, {
      actions: [{
        actionType: ActionType.ASSERT_PAGE_TITLE,
        content: 'Men\'s T-Shirts - SHOP',
      }, {
        actionType: ActionType.ASSERT_CONTENT,
        selector: 'shop-app::shadowRoot shop-list::shadowRoot',
        content: 'Men\'s T-Shirts',
      }],
    }, {
      actionType: ActionType.CLICK,
      selector: 'shop-app::shadowRoot shop-list::shadowRoot ul > li:nth-child(1)',
    }, {
      actionType: ActionType.CLICK,
      selector: 'shop-app::shadowRoot shop-detail::shadowRoot #content shop-button > button',
      sleepAfter: 1000,
    }, {
      actionType: ActionType.CLICK,
      selector: 'shop-app::shadowRoot shop-cart-modal::shadowRoot #viewCartAnchor',
    }, {
      actionType: ActionType.ASSERT_PAGE_TITLE,
      content: 'Your cart - SHOP',
    }],
  }],
}

module.exports = task;
