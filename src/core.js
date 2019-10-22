const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const beautify = require('js-beautify').html;
const colors = require('colors');
const assert = require('assert');
const shuffle = require('shuffle-array');
const NETWORK_CONFIG = require('./network-config');
const {
  JSDOM
} = require("jsdom");

const ActionType = {
  // Connect to a specific URL.
  URL: 'url',
  // Wait in seconds.
  SLEEP: 'sleep',
  // Wait for a specific element show up.
  WAIT_FOR_ELEMENT: 'waitForElement',
  // Type in an input element and submit the form.
  TYPE_THEN_SUBMIT: 'typeThenSubmit',
  // Click a specific element.
  CLICK: 'click',
  // Select a specific element with a value.
  SELECT: 'select',
  // Scroll to a specific elemnt.
  SCROLL_TO: 'scrollTo',
  // Assert that the page title equals to a specific value.
  ASSERT_PAGE_TITLE: 'assertPageTitle',
  // Assert that an element's inner text equals to a specific value.
  ASSERT_INNER_TEXT: 'assertInnerText',
  // Assert an element that matches CSS selector.
  ASSERT_EXIST: 'assertExist',
  // Assert a text content appears on the current page.
  ASSERT_CONTENT: 'assertContent',
  // Take a screenshot of the current page.
  SCREENSHOT: 'screenshot',
  // Write page content to a file.
  WRITE_TO_FILE: 'writeToFile',
  // Run a custom function.
  CUSTOM_FUNC: 'customFunc',
};

let logs = [];

// Return the page or iframe object.
function getPageObject(page, action) {
  if (typeof action.iframe === 'number') {
    logger('info', `    On iframe #${action.iframe}`);
    return page.frames()[action.iframe];
  } else if (typeof action.iframe === 'string') {
    logger('info', `    On iframe id = ${action.iframe}`);
    return page.frames().find(frame => frame.name() === action.iframe);
  }
  return page;
}

async function outputToFile(filename, text) {
    let filePath = path.resolve(filename);
    await fse.outputFile(filePath, text);
}

async function outputHtmlToFile(filename, content) {
  // Output content
  let html = beautify(content, {
    indent_size: 2,
    preserve_newlines: false,
    content_unformatted: ['script', 'style'],
  });
  await outputToFile(filename, html);
}

async function runTask(task, options) {
  assert(task, 'Missing task');

  let visits = task.visits || 1;
  let percentages = task.flows.map(flow => flow.percentage);
  let denominator = percentages.reduce((a, b) => a + b);
  let flowSeries = [];

  Object.keys(task).forEach(key => {
    if (key !== 'flows') options[key] = task[key];
  });

  console.log(options);

  for (let i=0; i<task.flows.length; i++) {
    numFlow = Math.round(visits * task.flows[i].percentage / denominator);
    for (let j=0; j<numFlow; j++) {
      flowSeries.push(i);
    }
  }
  shuffle(flowSeries);

  for (let k=0; k<visits; k++) {
    console.log(`Running flow ${k}...`.cyan);
    await runFlow(task.flows[flowSeries[k]], {
      flowNumber: k,
    }, options);
  }
}

async function runFlow(flow, context, options) {
  let error = null;
  let browser, page, content;
  let outputPath = options.outputPath;
  let device = options.device || 'Pixel 2'
  let waitOptions = {
    waitUntil: [options.networkidle || 'networkidle0', 'load'],
  };

  // Default sleep between steps: 1 second.
  let sleepAfterEachAction = options.sleepAfterEachAction || 1000;
  let sleepAfterEachStep = options.sleepAfterEachStep || 1000;

  logs = [];

  try {
    assert(flow.steps, 'Missing steps in flow.');
    logger('info', `Use device ${device}`);

    // Init puppeteer.
    browser = await puppeteer.launch({
      headless: options.isHeadless,
      args: [`--window-size=${options.windowWidth},${options.windowHeight}`],
    });
    page = await browser.newPage();
    await page.emulate(devices[device]);
    if (options.showConsoleOutput) {
      page.on('console',
          msg => logger('console', `\tPage console output: ${msg.text()}`));
    }

    // Create a dummy file for the path.
    let filePath = path.resolve(`${outputPath}/flow-${context.flowNumber}/result.json`);
    await fse.outputFile(filePath, '{}');

    // Set Network speed.
    // Connect to Chrome DevTools and set throttling property.
    const devTools = await page.target().createCDPSession()
    if (options.networkConfig) {
      await devTools.send('Network.emulateNetworkConditions', options.networkConfig);
    }

    // Override user agent.
    if (options.userAgent) {
      page.setUserAgent(options.userAgent);
    }

    // Simulate request blocking in Chrome DevTools.
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      let isAbort = false;
      (flow.requestBlocking || []).forEach((regex) => {
        if (regex && regex.test(request.url())) {
          logger('info', `Request blocking: ${request.url()}`);
          isAbort = true;
        }
      });
      isAbort ? request.abort() : request.continue();
    });

    // Extend querySelectorDeep to Element and Document.
    page.once('load', async () => {
      await page.addScriptTag({path: __dirname + '/script-querySelectorDeep.js'});
    });

    // Execute steps.
    for (var i = 0; i < flow.steps.length; i++) {
      let step = flow.steps[i];
      let stepLog = `Step ${i+1}`;
      if (step.log) stepLog += `: ${step.log}`;
      logger('step', stepLog);

      let actions = step.actions || [step];
      if (!actions || step.skip) {
        logger('info', 'no actions or skipped');
        continue;
      };

      let actionNumber = 0;
      for (let [index, action] of Object.entries(actions)) {
        actionNumber++;
        let message = action.actionType;

        // Get page instance for current document or iframe.
        let pageObj = getPageObject(page, action);
        let el;

        if (step.actions) {
          logger('action', `    action ${i+1}-${actionNumber}: ${action.actionType}`);
        } else {
          logger('action', `    action: ${action.actionType}`);
        }

        switch (action.actionType) {
          case ActionType.URL:
            await pageObj.goto(action.url);
            message = 'Opened URL ' + action.url;
            break;

          case ActionType.SLEEP:
            await pageObj.waitFor(parseInt(action.value));
            message = `Waited for ${action.value} ms`;
            break;

          case ActionType.WAIT_FOR_ELEMENT:
            await pageObj.waitFor(action.selector);
            message = `Waited for element ${action.selector}`;
            break;

          case ActionType.TYPE_THEN_SUBMIT:
            await pageObj.waitFor(action.selector);
            await pageObj.type(action.selector, action.inputText);
            await pageObj.keyboard.press('Enter');
            message = `Typed in element ${action.selector} with ${action.inputText}`;
            break;

          case ActionType.CLICK:
            {
              let elHandle = await pageObj.$(action.selector);
              if (!elHandle) throw new Error(`Unable to find element: \"${action.selector}\"`);

              elHandle.click();
              message = `Clicked element: ${action.selector}`;
            }
            break;

          case ActionType.SELECT:
            await pageObj.select(action.selector, action.value);
            message = `Selected ${value} for element: ${action.selector}`;
            break;

          case ActionType.SCROLL_TO:
            {
              await pageObj.evaluate((action) => {
                let el = document.querySelector(action.selector);
                if (el) el.scrollIntoView();
                return true;
              }, action);
              message = `Scrolled to element: ${action.selector}`;
            }
            break;

          case ActionType.ASSERT_PAGE_TITLE:
            {
              let pageTitle = await pageObj.title();
              if (!action.content && !action.contentRegex) {
                throw new Error('Missing match or matchRegex attributes in ASSERT_PAGE_TITLE action.');
              }
              if (action.content && action.content !== pageTitle) {
                throw new Error(`Page title "${pageTitle}" doesn't match ${action.content}`);
              }
              if (action.contentRegex && !action.contentRegex.match(pageTitle)) {
                throw new Error(`Page title "${pageTitle}" doesn't match ${action.contentRegex}`);
              }
              message = `Page title matched: "${pageTitle}"`;
            }
            break;

          case ActionType.ASSERT_INNER_TEXT:
            {
              let innerText = await pageObj.$eval(action.selector, el => el.innerText);
              if (!action.content && !action.contentRegex) {
                throw new Error('Missing match or matchRegex attributes in ASSERT_PAGE_TITLE action.');
              }
              if (action.content && action.content !== innerText) {
                throw new Error(`Expect element ${action.selector} to match ` +
                  `title as "${action.content}", but got "${innerText}".`);
              }
              if (action.contentRegex && !action.contentRegex.match(innerText)) {
                throw new Error(`Expect element ${action.selector} to match ` +
                  `title as "${action.contentRegex}", but got "${innerText}".`);
              }
              message = `Matched text for element ${action.selector}`;
            }
            break;

          case ActionType.ASSERT_EXIST:
            {
              let result = await pageObj.$eval(action.selector, el => el.nodeName);
              if (!result) throw new Error(`Unable to find ${action.selector}`);
            }
            break;

          case ActionType.ASSERT_CONTENT:
            {
              let content = action.content;
              let bodyContent = await pageObj.$eval(action.selector, el => el.textContent);
              if (bodyContent.indexOf(content) < 0 && bodyContent.indexOf(escapeXml(content))) {
                throw new Error(`Didn\'t see text \"${content}\"`);
              }
              message = `Saw text content \"${content}\" on the page.`;
            }
            break;

          case ActionType.SCREENSHOT:
            await page.screenshot({
              path: `${outputPath}/${action.filename}`
            });
            message = `Screenshot saved to ${action.filename}`;
            break;

          case ActionType.WRITE_TO_FILE:
            content = await pageObj.$eval(action.selector, el => el.outerHTML);
            await outputHtmlToFile(
              `${outputPath}/flow-${context.flowNumber}/${action.filename}`, content);
            message = `write ${action.selector} to ${action.filename}`;
            break;

          case ActionType.CUSTOM_FUNC:
            if (action.customFunc) {
              await action.customFunc(action, pageObj);
            }
            break;

          default:
            throw new Error(`action ${action.actionType} is not supported.`);
            break;
        }
        if (action.sleepAfter) await page.waitFor(action.sleepAfter);
        await page.waitFor(sleepAfterEachAction);

        logger('info', `\t${action.log || action.actionType}: ${message}`);
      }

      await page.waitFor(sleepAfterEachStep);

      if (options.screenshot) {
        await page.screenshot({
          path: `${outputPath}/flow-${context.flowNumber}/step-${i+1}.png`
        });
      }

      // Output to file.
      if (flow.outputHtmlToFile) {
        await outputHtmlToFile(
          `${outputPath}/flow-${context.flowNumber}/output-step-${i+1}.html`,
          await page.content());
      }
    }

  } catch (e) {
    error = e;

  } finally {
    if (page) {
      let filePath = path.resolve(`${outputPath}/flow-${context.flowNumber}/result.json`);
      await fse.outputFile(filePath, '{}');

      if (options.screenshot) {
        await page.screenshot({
          path: `${outputPath}/flow-${context.flowNumber}/step-final.png`
        });
      }

      await outputHtmlToFile(
        `${outputPath}/flow-${context.flowNumber}/output-step-final.html`,
        await page.content());
    }

    await outputToFile(`${outputPath}/output-logs.txt`, logs.join('\r\n'));

    console.log('Flow Complete.'.cyan);

    if (browser) await browser.close();
    if (error) throw error;
  }
}

function escapeXml(input) {
  return input.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&apos;');
}

function logger(type, msg) {
  if (!msg) return;

  logs.push(msg);
  switch(type) {
    case 'info':
    default:
      console.log(msg.reset);
      break;
    case 'error':
      console.log(msg.red);
      break;
    case 'step':
      console.log(msg.cyan);
      break;
    case 'action':
      console.log(msg.yellow);
      break;
    case 'console':
      console.log(msg.gray);
      break;
  }
}

/**
 * findElementByContent - Return the first ElementHandle that matches content.
 *
 * @param  {Page}     pageObj      Puppeteer page instance.
 * @param  {string}   selector     Query selector string.
 * @param  {string}   content        Content to match.
 * @param  {boolean}  visibleOnly  Whether to find visible elements only.
 * @return {ElementHandle}
 */
async function getElementHandleByContent(pageObj, selector, content, visibleOnly) {
  let handles = await pageObj.$$(selector);

  if (content) {
    for (let i=0; i<handles.length; i++) {
      let innerText = await (await handles[i].getProperty('innerText')).jsonValue();
      if (innerText && innerText.trim() && innerText === content) {
        if (visibleOnly && !await handles[i].isIntersectingViewport()) continue;
        return handles[i];
      }
    }
  }

  if (handles) return handles[0];

  logger('info', `Can\'t find element with content \"${content}\"`)
  return null;
}

module.exports = {
  ActionType: ActionType,
  runTask: runTask,
};
