const PuppetMaster = require('../src/core');
const ActionType = PuppetMaster.ActionType;

let task = {
  visits: 2, // Total number of simulated visits.
  isHeadless: true,
  device: 'Pixel 2',
  windowWidth: 450,
  windowHeight: 900,
  sleepAfterEachStep: 1000,
  sleepAfterEachAction: 1000,
  outputHtmlToFile: true,
  stopWhenFail: true,
  showConsoleOutput: false,
  userAgent: 'fake-useragent',
  flows: [{
    name: 'Add a product to cart',
    percentage: 0.5, // 50% of users
    steps: [{
      log: 'Go to sample eCommerce site',
      actions: [{
        actionType: ActionType.URL,
        url: 'http://jonchen-shop.firebaseapp.com',
      }, {
        actionType: ActionType.SLEEP,
        value: 1000,
      }]
    }, {
      actionType: ActionType.CLICK,
      selector: 'shop-app::shadowRoot shop-home::shadowRoot :nth-child(4) > shop-button',
    }, {
      actionType: ActionType.CLICK,
      selector: 'shop-app::shadowRoot shop-list::shadowRoot ul > li:nth-child(1)',
    }, {
      actionType: ActionType.CLICK,
      selector: 'shop-app::shadowRoot shop-detail::shadowRoot #content shop-button > button',
    }, {
      actionType: ActionType.CLICK,
      selector: 'shop-app::shadowRoot shop-cart-modal::shadowRoot #viewCartAnchor',
    }, {
      actionType: ActionType.ASSERT_PAGE_TITLE,
      content: 'Your cart - SHOP',
    }],
  }, {
    name: 'Navigate to PDP',
    percentage: 0.5, // 50% of users
    steps: [{
      log: 'Go to sample eCommerce site',
      actions: [{
        actionType: ActionType.URL,
        url: 'http://jonchen-shop.firebaseapp.com',
      }, {
        actionType: ActionType.SLEEP,
        value: 1000,
      }]
    }, {
      actionType: ActionType.CLICK,
      selector: 'shop-app::shadowRoot shop-home::shadowRoot :nth-child(4) > shop-button',
    }, {
      actionType: ActionType.CLICK,
      selector: 'shop-app::shadowRoot shop-list::shadowRoot ul > li:nth-child(1)',
    }],
  }],
}

module.exports = task;
