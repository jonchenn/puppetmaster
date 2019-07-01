const puppeteerTask = require('../src/core');
const ActionType = puppeteerTask.ActionType;

let task = {
  outputPath: 'output/test-amp-results/',
  isHeadless: false,
  browser: 'chrome',
  device: 'Pixel 2',
  windowWidth: 450,
  windowHeight: 900,
  sleepAfterEachStep: 1000,
  sleepAfterEachAction: 1000,
  outputHtmlToFile: true,
  stopWhenFail: true,
  steps: [{
    log: 'Search amp start on Google Search',
    actions: [{
      actionType: ActionType.URL,
      url: 'https://www.google.com/ncr',
    }, {
      actionType: ActionType.TYPE_THEN_SUBMIT,
      selector: 'input[name="q"]',
      inputText: 'amp start',
    }, {
      actionType: ActionType.ASSERT_PAGE_TITLE,
      match: 'amp start - Google Search',
    }]
  }, {
    log: 'Click first AMP result in the SERP',
    actions: [{
      log: 'Click first AMP result',
      actionType: ActionType.CLICK,
      // For non-AMP results: 'div[data-hveid] a.BmP5tf'
      // For AMP results: 'div[data-hveid] a.amp_r'
      selector: 'div[data-hveid] a.amp_r',
    }, {
      actionType: ActionType.ASSERT_INNER_TEXT,
      selector: '.amp-ttltxt',
      match: 'ampstart.com',
    }, {
      iframe: 1,
      actionType: ActionType.WRITE_TO_FILE,
      selector: 'html',
      filename: 'iframe-1.html',
    }]
  }, {
    log: 'Click iframe',
    actions: [{
      iframe: 1,
      actionType: ActionType.ASSERT_TEXT,
      match: 'Get started quickly with a ready-made design.',
    }, {
      iframe: 1,
      actionType: ActionType.CLICK,
      selector: '.ampstart-navbar-trigger',
    }, {
      iframe: 1,
      actionType: ActionType.CLICK_BY_TEXT,
      match: 'HOW IT WORKS',
    }],
  }, {
    log: 'Verify get started page content',
    actions: [{
      actionType: ActionType.ASSERT_TEXT,
      match: 'Work it works',
    }],
  }],
};

module.exports = task;
