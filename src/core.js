/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const beautify = require('js-beautify').html;
const colors = require('colors');
const assert = require('assert');
const NETWORK_CONFIG = require('./network-config');
const {
  JSDOM
} = require("jsdom");

const Status = {
  SUCCESS: 'success',
  ERROR: 'error',
};

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
  // Click a specific element.
  TAP: 'tap',
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
  // Assert a style change for a specific component.
  ASSERT_STYLE_CHANGE: 'assertStyleChange',
  // Start to measure how long a specific content is ready from the current timestamp. 
  MEASURE_CONTENT_READY: 'measureContentAppear',
  // Assert a style change for a specific component.
  STYLE_SNAPSHOT: 'styleSnapshot',
  // Take a screenshot of the current page.
  SCREENSHOT: 'screenshot',
  // Write page content to a file.
  WRITE_TO_FILE: 'writeToFile',
  // Run a custom function.
  CUSTOM_FUNC: 'customFunc',
};

class PuppetMaster {
  constructor(page, config) {
    assert(page, 'Parameter `page` is missing');
    this.logs = [];
    this.config = config || {};
    this.page = page;
    this.measures = {};
    this.verbose = config.verbose;
    this.debug = config.debug;
  }

  async runFlow(flow, options) {
    options = options || {};
    flow.flowIndex = flow.flowIndex || 1;

    let error = null;
    let browser, page, content;
    let outputPath = flow.outputPath || './';
    let device = flow.device || 'Pixel 2'
    let waitOptions = {
      waitUntil: [flow.networkidle || 'networkidle0', 'load'],
    };
    let flowResult = {
      steps: [],
    };

    // Default sleep between steps: 1 second.
    let sleepAfterEachStep = flow.sleepAfterEachStep || 0;
    let logs = [];

    try {
      assert(flow.steps, 'Missing steps in flow.');
      this.logger('info', `Use device ${device}`);

      await this.page.emulate(devices[device]);

      if (flow.showConsoleOutput) {
        this.page.on('console',
            msg => this.logger('console', `\tPage console output: ${msg.text()}`));
      }

      // Create a dummy file for the path.
      if (flow.outputToFile) {
        let filePath = path.resolve(`${outputPath}/flow-${flow.flowIndex}/result.json`);
        await fse.outputFile(filePath, '{}');
      }

      debugger;

      // Set Network speed.
      // Connect to Chrome DevTools and set throttling property.
      const devTools = await this.page.target().createCDPSession();
      if (flow.networkConfig) {
        await devTools.send(
          'Network.emulateNetworkConditions',
          NETWORK_CONFIG[flow.networkConfig]);
      }

      if (flow.disableCache) {
        await this.page.setCacheEnabled(false);
      }

      // Override user agent.
      if (flow.userAgent) {
        this.page.setUserAgent(flow.userAgent);
      }

      this.page.setDefaultNavigationTimeout(60000);

      // Extend querySelectorDeep to Element and Document.
      this.page.once('load', async () => {
        await this.page.addScriptTag({path: __dirname + '/script-querySelectorDeep.js'});
      });

      if (flow.tracing) {
        this.logger('info', 'Start tracing.');
        await this.page.tracing.start({
          screenshots: true,
          path: `${outputPath}/flow-${flow.flowIndex}/trace.json`
        });
      }

      flowResult.startTime = Date.now();

      // Cross-step variables:
      let context = {};

      // Execute steps.
      for (var i = 0; i < flow.steps.length; i++) {
        let step = flow.steps[i];
        let stepLog = `Step ${i+1}`;

        step.index = i + 1;
        if (step.log) stepLog += `: ${step.log}`;
        this.logger('step', stepLog);

        if (step.skip) {
          this.logger('info', 'step skipped');
          continue;
        };

        let stepStartTime = Date.now();
        let message = step.actionType;

        // Get page instance for current document or iframe.
        let pageObj = this.getPageObject(this.page, step);
        let el;

        this.logger('step', `    action: ${step.actionType}`);

        try {
          // Execute action and collect step-wide context.
          await this.executeAction(pageObj, step, context);
          step.status = Status.SUCCESS;
        } catch (e) {
          step.status = Status.ERROR;
          step.error = e;
        this.logger('error', `    action failed: ${e.message}`);
        }

        if (step.sleepAfter) await this.page.waitFor(step.sleepAfter);
        await this.page.waitFor(sleepAfterEachStep);

        flowResult.steps.push({
          log: stepLog,
          actionType: step.actionType,
          status: step.status,
          timelapseMs: Date.now() - flowResult.startTime,
        });

        flowResult.measures = this.measures;

        this.logger('info', `\t${step.log || step.actionType}: ${context.message || message}`);
      }

      await this.page.waitFor(sleepAfterEachStep);

      // Take screenshot.
      if (flow.outputScreenshot) {
        await this.page.screenshot({
          path: `${outputPath}/flow-${flow.flowIndex}/step-${i+1}.png`
        });
      }

      // Output to file.
      if (flow.outputToFile) {
        await this.outputHtmlToFile(
          `${outputPath}/flow-${flow.flowIndex}/output-step-${i+1}.html`,
          await this.page.content());
      }

    } catch (e) {
      error = e;

    } finally {
      if (this.page) {
        flowResult.endTime = Date.now();
        flowResult.timelapse = flowResult.endTime - flowResult.startTime;

        if (flow.outputResultToFile) {
          let filePath = path.resolve(`${outputPath}/flow-${flow.flowIndex}/result.json`);
          await fse.outputFile(filePath, JSON.stringify(flowResult));
        }

        if (flow.outputScreenshot) {
          await this.page.screenshot({
            path: `${outputPath}/flow-${flow.flowIndex}/step-final.png`
          });
        }

        if (flow.outputToFile) {
          await this.outputHtmlToFile(
            `${outputPath}/flow-${flow.flowIndex}/output-step-final.html`,
            await this.page.content());
        }
        if (flow.tracing) {
          await this.page.tracing.stop();
        }
      }

      if (flow.outputResultToFile) {
        await this.outputToFile(`${outputPath}/output-logs.txt`,
            this.logs.join('\r\n'));
      }

      // if (this.browser) await browser.close();
      if (error) {
        console.log('Flow terminated with erorr.'.red);
        console.log(error);
        flowResult.error = error.message;
        flowResult.status = Status.ERROR;

      } else {
        console.log('Flow Complete.'.cyan);
        flowResult.status = Status.SUCCESS;
      }

      return flowResult;
    }
  }

  async executeAction(pageObj, step, context) {
    switch (step.actionType) {
      case ActionType.URL:
        await pageObj.goto(step.url, {waitUntil: 'domcontentloaded'});
        context.message = 'Opened URL ' + step.url;
        break;

      case ActionType.SLEEP:
        await pageObj.waitFor(parseInt(step.value));
        context.message = `Waited for ${step.value} ms`;
        break;

      case ActionType.WAIT_FOR_ELEMENT:
        {
          let startTimestamp = Date.now();
          await pageObj.waitFor(step.selector);
          let timelapseMs = Date.now() - startTimestamp;
          context.message = `Waited for element ${step.selector}: ${timelapseMs} ms`;  
        }
        break;

      case ActionType.TYPE_THEN_SUBMIT:
        await pageObj.waitFor(step.selector);
        await pageObj.type(step.selector, step.inputText);
        await pageObj.keyboard.press('Enter');
        context.message = `Typed in element ${step.selector} with ${step.inputText}`;
        break;

      case ActionType.CLICK:
        {
          let elHandle = await pageObj.$(step.selector);
          if (!elHandle) throw new Error(`Unable to find element: \"${step.selector}\"`);

          elHandle.click();
          context.message = `Clicked element: ${step.selector}`;
        }
        break;

      case ActionType.TAP:
        {
          await pageObj.tap(step.selector);
          context.message = `Tapped element: ${step.selector}`;
        }
        break;

      case ActionType.SELECT:
        await pageObj.select(step.selector, step.value);
        context.message = `Selected ${value} for element: ${step.selector}`;
        break;

      case ActionType.SCROLL_TO:
        {
          await pageObj.evaluate((step) => {
            let el = document.querySelector(step.selector);
            if (el) el.scrollIntoView();
            return true;
          }, step);
          context.message = `Scrolled to element: ${step.selector}`;
        }
        break;

      case ActionType.ASSERT_PAGE_TITLE:
        {
          let pageTitle = await pageObj.title();
          if (!step.value && !step.valueRegex) {
            throw new Error('Missing value or valueRegex attributes in ASSERT_PAGE_TITLE step.');
          }
          if (step.value && step.value !== pageTitle) {
            throw new Error(`Page title "${pageTitle}" doesn't match ${step.value}`);
          }
          if (step.valueRegex && !step.valueRegex.match(pageTitle)) {
            throw new Error(`Page title "${pageTitle}" doesn't match ${step.valueRegex}`);
          }
          context.message = `Page title matched: "${pageTitle}"`;
        }
        break;

      case ActionType.ASSERT_INNER_TEXT:
        {
          let innerText = await pageObj.$eval(step.selector, el => el.innerText);
          if (!step.value && !step.valueRegex) {
            throw new Error('Missing value or valueRegex attributes in ASSERT_PAGE_TITLE step.');
          }
          if (step.value && step.value !== innerText) {
            throw new Error(`Expect element ${step.selector} to match ` +
              `title as "${step.value}", but got "${innerText}".`);
          }
          if (step.valueRegex && !step.valueRegex.match(innerText)) {
            throw new Error(`Expect element ${step.selector} to match ` +
              `title as "${step.valueRegex}", but got "${innerText}".`);
          }
          context.message = `Matched text for element ${step.selector}`;
        }
        break;

      case ActionType.ASSERT_EXIST:
        {
          let result = await pageObj.$eval(step.selector, el => el.nodeName);
          if (!result) throw new Error(`Unable to find ${step.selector}`);
        }
        break;

      case ActionType.ASSERT_CONTENT:
        {
          let content = step.value;
          let bodyContent = await pageObj.$eval(
              step.selector || 'body', el => el.textContent);
          if (bodyContent.indexOf(content) < 0 && bodyContent.indexOf(this.escapeXml(content))) {
            throw new Error(`Didn\'t see text \"${content}\"`);
          }
          context.message = `Saw text content \"${content}\" on the page.`;
        }
        break;

      case ActionType.STYLE_SNAPSHOT:
        {
          assert(step.selector,
              'Missing selector attribute in STYLE_SNAPSHOT step.');
          // Sample style snapshot:
          // form.a[div.b[input.c,input.d],div.e]
          context.styleSnapshot = await pageObj.evaluate(
              this.evaluteStyleSnapshot, step);
        }
        break;

      case ActionType.ASSERT_STYLE_CHANGE:
        {
          assert(step.selector,
              'Missing selector attribute in STYLE_SNAPSHOT step.');
          let newStyleSnapshot = await pageObj.evaluate(this.evaluteStyleSnapshot, step);
          if (newStyleSnapshot === context.styleSnapshot) {
            throw new Error(`No styles change detected`);
          }
        }
        break;

      case ActionType.SCREENSHOT:
        await page.screenshot({
          path: `${outputPath}/${step.filename}`
        });
        context.message = `Screenshot saved to ${step.filename}`;
        break;

      case ActionType.WRITE_TO_FILE:
        content = await pageObj.$eval(step.selector, el => el.outerHTML);
        await this.outputHtmlToFile(
          `${outputPath}/flow-${flow.flowIndex}/${step.filename}`, content);
        context.message = `write ${step.selector} to ${step.filename}`;
        break;

      case ActionType.MEASURE_CONTENT_READY:
        {
          let name = step.name || `step-${step.index}`;
          this.measures[name] = {
            selector: step.selector,
            startTimestamp: Date.now(),
          };
  
          pageObj.waitForSelector(step.selector).then(() => {
            let endTimestamp = Date.now();
            let startTimestamp = this.measures[name].startTimestamp;
            this.measures[name].endTimestamp = endTimestamp;
            this.measures[name].timelapseMs = endTimestamp - startTimestamp;
          })  
        }
        break;

      case ActionType.CUSTOM_FUNC:
        if (step.customFunc) {
          await step.customFunc(step, pageObj);
        }
        break;

      default:
        if (this.debug) {
          console.log(step);
        }
        throw new Error(`action ${step.actionType} is not supported.`);
        break;
    }
    return context;
  }

  evaluteStyleSnapshot(step) {
    let el = document.querySelector(step.selector);
    let elements = [el];
    let styles = '';

    // Iterate through all elements and their children.
    while (elements.length > 0) {
      el = elements.shift();

      // When this element is simply a string, append to the styles.
      if (typeof el === 'string') {
        styles += el;
        continue;
      }

      // Otherwise, add this element's tag name and its class names.
      styles +=
          el.tagName + '.' + el.className.split(' ').join('.');

      // Put childrens into the elements array for next iteration.
      if (el.childElementCount > 0) {
        elements = ['[', ...Array.from(el.children), '],', ...elements];
      }

      // Add a comma for sibling elements.
      if (elements[0] !== '[' && elements[0] !== ']') styles += ',';
    }
    return styles;
  }

  // Return the page or iframe object.
  getPageObject(page, step) {
    if (typeof step.iframe === 'number') {
      this.logger('info', `    On iframe #${step.iframe}`);
      return page.frames()[step.iframe];
    } else if (typeof step.iframe === 'string') {
      this.logger('info', `    On iframe id = ${step.iframe}`);
      return page.frames().find(frame => frame.name() === step.iframe);
    }
    return page;
  }

  async outputToFile(filename, text) {
      let filePath = path.resolve(filename);
      await fse.outputFile(filePath, text);
  }

  async outputHtmlToFile(filename, content) {
    // Output content
    let html = beautify(content, {
      indent_size: 2,
      preserve_newlines: false,
      content_unformatted: ['script', 'style'],
    });
    await this.outputToFile(filename, html);
  }

  escapeXml(input) {
    return input.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&apos;');
  }

  logger(type, msg) {
    if (!msg) return;

    this.logs.push(msg);
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
}

module.exports = {
  ActionType: ActionType,
  PuppetMaster: PuppetMaster,
};
