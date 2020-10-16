const PuppetMaster = require('../src/core');
const ActionType = PuppetMaster.ActionType;

let taskFlow = {
  visits: 2, // Total number of simulated visits.
  device: 'Pixel 2',
  windowWidth: 450,
  windowHeight: 900,
  sleepAfterEachStep: 0,
  outputHtmlToFile: true,
  stopWhenFail: false,
  showConsoleOutput: false,
  disableCache: false,
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
    actionType: ActionType.SLEEP,
    value: 1000,
  }, {
    name: 'LCP-Article',
    log: 'Measure how long it takes to show the first image',
    actionType: ActionType.MEASURE_CONTENT_READY,
    selector: '#content > div.learn-landing-page > section:nth-child(2) > div:nth-child(2) > a:nth-child(1) > div > div.w-path-card__cover > img',
  }, {
    log: 'Click "Learn" in the main menu',
    actionType: ActionType.CLICK,
    selector: 'body > web-side-nav > nav > a:nth-child(2)',
  }, {
    actionType: ActionType.SLEEP,
    value: 1000,
  }, {
    log: 'Click the first image',
    actionType: ActionType.CLICK,
    selector: '#content > div.learn-landing-page > section:nth-child(2) > div:nth-child(2) > a:nth-child(1) > div > div.w-path-card__cover > img',
  }, {
    actionType: ActionType.SLEEP,
    value: 2000,
  }],
}

module.exports = taskFlow;
