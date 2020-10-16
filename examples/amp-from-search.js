const puppeteerTask = require('../src/core');
const ActionType = puppeteerTask.ActionType;

let taskFlow = {
  outputPath: 'output/amp-from-search/',
  isHeadless: false,
  browser: 'chrome',
  device: 'Pixel 2',
  windowWidth: 450,
  windowHeight: 900,
  sleepAfterEachStep: 1000,
  sleepAfterEachAction: 1000,
  outputHtmlToFile: true,
  screenshot: true,
  stopWhenFail: true,
  steps: [{
    log: 'Search amp start on Google Search',
    actionType: ActionType.URL,
    url: 'https://www.google.com/ncr',
  }, {
    actionType: ActionType.TYPE_THEN_SUBMIT,
    selector: 'input[name="q"]',
    inputText: 'amp start',
  }, {
    actionType: ActionType.ASSERT_PAGE_TITLE,
    content: 'amp start - Google Search',
  }, {
    log: 'Click first AMP result in the SERP',
    actionType: ActionType.CLICK,
    // For non-AMP results: 'div[data-hveid] a.BmP5tf'
    // For AMP results: 'div[data-hveid] a.amp_r'
    selector: 'div[data-hveid] a.amp_r',
  }, {
    actionType: ActionType.ASSERT_INNER_TEXT,
    selector: '.amp-ttltxt',
    content: 'ampstart.com',
  }, {
    iframe: 1,
    actionType: ActionType.WRITE_TO_FILE,
    selector: 'html',
    filename: 'iframe-1.html',
  }, {
    log: 'Click iframe',
    iframe: 1,
    actionType: ActionType.ASSERT_TEXT,
    content: 'Get started quickly with a ready-made design.',
  }, {
    iframe: 1,
    actionType: ActionType.CLICK,
    selector: '.ampstart-navbar-trigger',
  }, {
    iframe: 1,
    actionType: ActionType.CLICK_BY_TEXT,
    content: 'HOW IT WORKS',
  }, {
    log: 'Verify get started page content',
    actions: [{
      actionType: ActionType.ASSERT_TEXT,
      content: 'Work it works',
    }],
  }],
};

module.exports = taskFlow;
