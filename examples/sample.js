const PuppetMaster = require('../src/core');
const ActionType = PuppetMaster.ActionType;

let taskFlow = {
  visits: 2, // Total number of simulated visits.
  isHeadless: true,
  device: 'Pixel 2',
  windowWidth: 450,
  windowHeight: 900,
  sleepAfterEachStep: 0,
  outputHtmlToFile: true,
  stopWhenFail: false,
  showConsoleOutput: false,
  userAgent: 'fake-useragent',
  steps: [{
    log: 'Go to Web.dev',
    actionType: ActionType.URL,
    url: 'https://web.dev/',
  }, {
    actionType: ActionType.SLEEP,
    value: 1000,
  }, {
    log: 'Open the main menu',
    actionType: ActionType.CLICK,
    selector: 'body > web-header > button',
  }, {
    log: 'Click "Learn" in the main menu',
    actionType: ActionType.CLICK,
    selector: 'body > web-side-nav > nav > a:nth-child(2)',
  }, {
    log: 'Click the first image',
    actionType: ActionType.CLICK,
    selector: '#content > div.learn-landing-page > section:nth-child(2) > div:nth-child(2) > a:nth-child(1) > div > div.w-path-card__cover > img',
  }, {
    log: 'Check if the title matches "web.dev"',
    actionType: ActionType.ASSERT_PAGE_TITLE,
    value: 'web.dev',
  }, {
    log: 'Verify a random content',
    actionType: ActionType.ASSERT_CONTENT,
    value: 'Some content that doesn\'t exist on the page.',
  }, {
    log: 'Verify if the content exists on the page',
    actionType: ActionType.ASSERT_CONTENT,
    value: 'Essential metrics for a healthy site.',
  }],
}

module.exports = taskFlow;
