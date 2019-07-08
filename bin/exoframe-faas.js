#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {setup, getLogsForFunction, getLoadedFunctions} = require('../src');

// get current folder
const currentFolder = process.cwd();
const folderName = path.basename(currentFolder);
const cfgPath = path.join(currentFolder, 'exoframe.json');
const config = require(cfgPath);

// get user homedir
const homeDir = os.homedir();

// get or create new exoframe folder if not present
const exoframeDir = path.join(homeDir, '.exoframe');
if (!fs.existsSync(exoframeDir)) {
  fs.mkdirSync(exoframeDir);
}

// get or create new faas temp folder if not present
const faasFolder = path.join(exoframeDir, 'faas-temp');
if (!fs.existsSync(faasFolder)) {
  fs.mkdirSync(faasFolder);
}

// link current folder to temp folder
const targetFolder = path.join(faasFolder, folderName);
fs.symlinkSync(currentFolder, targetFolder);

// listen for process exit to cleanup
const cleanup = () => {
  console.log('\nRunning cleanup...');
  // remove link to current folder
  fs.unlinkSync(targetFolder);
  console.log('Done! Exiting..');
  // exit
  process.exit();
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// start work
const fastifyMiddleware = setup({faasFolder});

// get loaded function
const loadedFunctions = getLoadedFunctions();
const loadedFunction = loadedFunctions[Object.keys(loadedFunctions)[0]];

// if function is http - start fastify
if (loadedFunction.type === 'http') {
  try {
    const fastifyPath = require.resolve('fastify', {paths: [currentFolder]});
    const fastify = require(fastifyPath);
    fastify()
      .register(fastifyMiddleware)
      .listen(8080, '0.0.0.0');
  } catch (e) {
    console.error('Error! You also need to install fastify to run HTTP functions.');
    cleanup();
    return;
  }
}

// poll function logs every second
const printLogs = () => {
  process.stdout.cursorTo(0, 0);
  process.stdout.clearScreenDown();
  const logs = getLogsForFunction(config.name);
  if (!config.type || config.type === 'http') {
    process.stdout.write(`Function is available at: \x1b[36mhttp://localhost:8080${loadedFunction.route}\x1b[0m\n`);
  }
  process.stdout.write('Logs from current function:\n');
  if (!logs.length) {
    process.stdout.write('Waiting for logs..\n');
    return;
  }
  logs.forEach(line => {
    const parts = line.split(/\dZ\s/);
    const date = new Date(parts[0]);
    const msg = parts[1];
    process.stdout.write(`\x1b[2m${date.toLocaleDateString()} ${date.toLocaleTimeString()}\x1b[0m ${msg}`);
  });
};
printLogs();
setInterval(printLogs, 1000);
