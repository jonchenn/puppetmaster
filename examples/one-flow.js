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
        actionType: ActionType.ASSERT_PAGE_TITLE,
        content: 'Home - SHOP',
      }]
    }, {
      actionType: ActionType.ASSERT_EXIST,
      selector: 'shop-app',
    }, {
      actionType: ActionType.ASSERT_EXIST,
      selector: 'iron-pages',
    }, {
      actionType: ActionType.SCROLL_TO,
      content: 'Men\'s T-Shirts',
    }, {
      selector: 'shop-home[name=home] item:nth-child(3) > shop-button',
      actionType: ActionType.CLICK,
      // content: 'Shop Now',
      sleepAfter: 2000,
    }, {
      actions: [{
        actionType: ActionType.ASSERT_PAGE_TITLE,
        content: 'Men\'s T-Shirts - SHOP',
      }, {
        actionType: ActionType.ASSERT_CONTENT,
        content: 'Men\'s T-Shirts',
      }],
    }, {
      actionType: ActionType.CLICK,
      content: 'YouTube Organic Cotton T-Shirt - Grey',
    }, {
      actionType: ActionType.CLICK,
      content: 'ADD TO CART',
      sleepAfter: 1000,
    }, {
      actionType: ActionType.CLICK,
      content: 'VIEW CART',
    }, {
      actionType: ActionType.ASSERT_PAGE_TITLE,
      content: 'Your cart - SHOP',
    }],
  }],
}

module.exports = task;
