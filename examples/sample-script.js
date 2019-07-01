const puppeteerTask = require('../src/core');
const ActionType = puppeteerTask.ActionType;

let task = {
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
      content: 'Shrine',
    }]
  }, {
    actionType: ActionType.SCROLL_TO,
    content: 'Sunglasses',
  }, {
    actionType: ActionType.SCROLL_TO,
    selector: '.category-card-wrapper',
    content: 'Beachball',
  }, {
    actionType: ActionType.CLICK,
    content: 'Sunglasses',
  }, {
    actionType: ActionType.ASSERT_CONTENT,
    content: 'Be an optimist.',
  }, {
    actionType: ActionType.CLICK,
    content: 'Quantity 1',
  }, {
    actionType: ActionType.CLICK,
    content: 'Quantity 5',
  }],
};

module.exports = task;
