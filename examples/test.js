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
      actionType: ActionType.CUSTOM_FUNC,
      customFunc: async (action, page) => {
        await page.evaluate((action) => {
          console.log(action.type);
        }, action);
      },
    }],
  }],
}

module.exports = task;
