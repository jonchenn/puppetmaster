const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const beautify = require('js-beautify').html;
const colors = require('colors');
const assert = require('assert');
const {
  JSDOM
} = require("jsdom");

const utils = require('./utils');

const ActionType = {
  // Connect to a specific URL.
  URL: 'url',
  // Wait in seconds.
  WAIT_SECONDS: 'waitSeconds',
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
  let error = null;
  let browser, page, content;
  let outputPath = options.outputPath;
  let device = task.device || 'Pixel 2'
  let waitOptions = {
    waitUntil: ['load', 'networkidle0'],
  };

  // Default sleep between steps: 1 second.
  let sleepAfterEachAction = task.sleepAfterEachAction || 1000;
  let sleepAfterEachStep = task.sleepAfterEachStep || 1000;

  logs = [];

  try {
    assert(task.browser, 'Missing browser in task.');
    assert(task.steps, 'Missing steps in task.');
    logger('info', `Use device ${device}`);

    // Init puppeteer.
    browser = await puppeteer.launch({
      headless: options.isHeadless,
      args: [`--window-size=${task.windowWidth},${task.windowHeight}`],
    });
    page = await browser.newPage();
    await page.emulate(devices[device]);
    if (task.showConsoleOutput) {
      page.on('console',
          msg => logger('console', `\tPage console output: ${msg.text()}`));
    }

    // Override user agent.
    if (task.userAgent) {
      page.setUserAgent(task.userAgent);
    }

    // Extend Document and Eelemnt prototypes with querySelectorShadowDom.
    page.evaluate(() => {
      Element.prototype.querySelectorShadowDom = function(selectors) {
        return utils.querySelectorShadowDom(this, selectors);
      };

      Document.prototype.querySelectorShadowDom = function(selectors) {
        return utils.querySelectorShadowDom(this, selectors);
      };
    }, utils);

    // Create a dummy file for the path.
    let filePath = path.resolve(`${outputPath}/.dummy.txt`);
    await fse.outputFile(filePath, '');

    // Execute steps.
    for (var i = 0; i < task.steps.length; i++) {
      let step = task.steps[i];
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

          case ActionType.WAIT_SECONDS:
            await pageObj.waitFor(parseInt(action.value));
            message = `Waited for ${action.value} seconds`;
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
              let elHandle = await getElementHandleByContent(
                  pageObj, action.selector || '*', action.content,
                  true /* visibleOnly */);
              if (!elHandle) throw new Error(`Unable to find visible element with content \"${action.content}\"`);
              elHandle.click();
            }
            message = `Clicked element - selector: ${action.selector}, content: ${action.content}`;
            break;

          case ActionType.SELECT:
            await pageObj.select(action.selector, action.value);
            message = `Selected ${value} for element ${action.selector}`;
            break;

          case ActionType.SCROLL_TO:
            {
              await pageObj.evaluate((action) => {
                let selector = action.selector || '*';
                let elements = document.querySelectorAll(selector);
                if (elements && action.content) {
                  elements = Array.prototype.filter.call(
                    elements, x => x.innerText === action.content);
                }
                if (elements[0]) elements[0].scrollIntoView();
                return true;
              }, action);
              message = `Scrolled to element with content ${action.content}`;
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
              message = `Page title "${pageTitle}" matches ${action.contentRegex}`;
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
            el = await pageObj.evaluate(() => {
              document.querySelectorShadowDom(action.selector);
            }, action);
            if (!el) throw new Error(`Unable to find ${action.selector}`);
            break;

          case ActionType.ASSERT_CONTENT:
            {
              let content = action.content;
              let bodyContent = await page.evaluate(
                  () => document.querySelector('body').innerText);
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
              `${outputPath}/${action.filename}`, content);
            message = `write ${action.selector} to ${action.filename}`;
            break;

          case ActionType.CUSTOM_FUNC:
            if (action.customFunc) {
              await action.customFunc(action, page);
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
      await page.screenshot({
        path: `${outputPath}/step-${i+1}.png`
      });

      // Output to file.
      if (task.outputHtmlToFile) {
        await outputHtmlToFile(
          `${outputPath}/output-step-${i+1}.html`,
          await page.content());
      }
    }

  } catch (e) {
    error = e;

  } finally {
    if (page) {
      await page.screenshot({
        path: `${outputPath}/step-final.png`
      });
      await outputHtmlToFile(
        `${outputPath}/output-step-final.html`,
        await page.content());
    }

    await outputToFile(`${outputPath}/output-logs.txt`, logs.join('\r\n'));

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
