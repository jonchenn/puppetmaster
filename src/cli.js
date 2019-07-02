/* eslint no-unused-vars: "warn" */

const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const fse = require('fs-extra');
const mkdirp = require('mkdirp');
const puppemaster = require('./core');
const colors = require('colors');


/**
 * Print CLI usage.
 */
function printUsage() {
  const usage = `
Usage: puppetmaster [TASK_FILE] --output=[OUTPUT_PATH]

Required:
  TASK_FILE\tPath to the task JS file to run.

Options:
  --output=OUTPUT_PATH\tPath to output task results.
  --screenshot\t\tWhether to take screenshot for each step.
  --print\t\tPrint report outcome.
  --verbose\t\tDisplay process details.

Examples:
  # Test if Google Search returns expected result.
  ./puppetmaster examples/sample-script.js
  `;
  console.log(usage);
}

/**
 * Print CLI usage in short format.
 */
function printShortUsage() {
  const usage = `Usage: puppetmaster [TASK_FILE] --output=[OUTPUT_PATH]

Specify --help for available options.
`;
  console.log(usage);
}


/**
 * Main CLI function.
 */
async function begin() {
  const params = argv['_'] || [];
  const screenshot = argv['screenshot'] || false;
  const print = argv['print'] || false;
  const verbose = argv['verbose'] || false;
  const help = argv['help'];
  const headless = argv['headless'];
  const taskFile = params[0];

  if (help) {
    printUsage();
    process.exit();
  }
  if (!params || !taskFile) {
    printShortUsage();
    process.exit();
  }

  // Use ./output/{scriptName} as default output folder.
  let scriptName = (taskFile.match(/(.*)\.js$/) || {})[1];
  const outputPath = argv['output'] || `./output/${scriptName.replace(/\//ig, '|')}`;

  if (!scriptName) {
    printShortUsage();
    process.exit();
  }

  try {
    console.log(`PuppetMaster begins.`.cyan);

    // Create directory if it doesn't exist.
    mkdirp(`./${outputPath}/`, (err) => {
      if (err) throw new Error(`Unable to create directory ${err}`);
    });

    console.log(`Loading task ${taskFile}`.cyan);

    let task;
    try {
      task = require(`../${scriptName}`);
    } catch (e) {
      console.log(`Unable to load task script: ${taskFile}`.red);
      console.error(e);
      return;
    }

    const result = await puppemaster.runTask(task, {
      screenshot: screenshot,
      outputPath: outputPath,
      isHeadless: !!headless,
    });

    const json = JSON.stringify(result, null, 4);

    await fse.outputFile(path.resolve(`./${outputPath}/result.json`), json);
    console.log(`Saved result to ./${outputPath}/result.json`.cyan);

    if (print) {
      console.log('Report:'.cyan);
      console.log(json);
    }
    console.log('Complete.'.green);

  } catch (e) {
    console.log(`${e.name}: ${e.message}`.red);
    if (verbose) console.trace(e);

    console.log('Complete with errors.'.yellow);
    process.exit();
  }
}

module.exports = {
  begin,
};
