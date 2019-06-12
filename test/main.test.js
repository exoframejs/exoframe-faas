/* eslint-env jest */
const path = require('path');
const initFastify = require('fastify');
const getPort = require('get-port');
const fse = require('fs-extra');

// setup function
const {setup, getLogsForFunction, listFunctions, registerFunction, removeFunction} = require('../index');

// basic sleep function
const sleep = t => new Promise(r => setTimeout(r, t));

// storage vars
let fastify;
// path to test folder
const faasFolder = path.join(__dirname, 'fixtures', 'existing');
// path to install folder
const installFolder = path.join(__dirname, 'fixtures', 'install');
// test function folder
const workerFolder = 'test-worker-fn';
const workerUpdateFolder = 'test-worker-up-fn';
const triggerFolder = 'test-trigger-fn';
const triggerUpdateFolder = 'test-trigger-up-fn';
const triggerHandlerName = 'test-triggered-fn';

beforeAll(async done => {
  fastify = initFastify();
  // get free ports
  const port = await getPort();
  // load middleware
  const middleware = setup({faasFolder});
  // start server
  await fastify.register(middleware).listen(port, '0.0.0.0');
  done();
});

afterAll(() => fastify.close());

test('Should call basic HTTP function', async done => {
  // test http function
  const response = await fastify.inject({
    method: 'GET',
    url: `/test`,
  });
  expect(response.statusCode).toEqual(200);
  expect(response.body).toEqual('hello world');

  done();
});

test('Should not call non-HTTP function', async done => {
  // make sure non-http function doesn't return anything
  const nonHttpResponse = await fastify.inject({
    method: 'GET',
    url: `/test-nonhttp-fn`,
  });
  expect(nonHttpResponse.statusCode).toEqual(404);

  done();
});

test('Should get logs for function', async done => {
  const logs = getLogsForFunction('test-http-fn');
  // remove dates
  const cleanLogs = logs.map(line => line.split('Z')[1].trim());
  expect(cleanLogs).toMatchSnapshot();
  done();
});

test('Should register new function', async done => {
  // copy test folder to existing
  const srcPath = path.join(installFolder, workerFolder);
  const destPath = path.join(faasFolder, workerFolder);
  await fse.copy(srcPath, destPath);

  // register new function
  await registerFunction({faasFolder, folder: workerFolder});

  const functions = listFunctions({functionToContainerFormat: fn => fn});
  expect(functions).toHaveLength(4);
  expect(functions.find(fn => fn.route === '/test-worker-fn')).toBeDefined();

  done();
});

test('Should update existing function', async done => {
  // copy test folder to existing
  const srcPath = path.join(installFolder, workerUpdateFolder);
  const destPath = path.join(faasFolder, workerUpdateFolder);
  await fse.copy(srcPath, destPath);

  // register new function
  await registerFunction({faasFolder, folder: workerUpdateFolder});

  const functions = listFunctions({functionToContainerFormat: fn => fn});
  expect(functions).toHaveLength(4);
  expect(functions.find(fn => fn.route === '/test-worker-fn')).toBeDefined();

  await sleep(500);

  const logs = getLogsForFunction(workerFolder);
  expect(logs.find(l => l.includes('Updated worker started'))).toBeDefined();

  done();
});

test('Should remove existing function', async done => {
  await removeFunction({id: workerFolder});

  const functions = listFunctions({functionToContainerFormat: fn => fn});
  expect(functions).toHaveLength(3);
  expect(functions.find(fn => fn.route === '/test-worker-fn')).toBeUndefined();

  done();
});

test('Should register new trigger function', async done => {
  // copy test folder to existing
  const srcPath = path.join(installFolder, triggerFolder);
  const destPath = path.join(faasFolder, triggerFolder);
  await fse.copy(srcPath, destPath);

  // register new function
  await registerFunction({faasFolder, folder: triggerFolder});

  const functions = listFunctions({functionToContainerFormat: fn => fn});
  expect(functions).toHaveLength(4);
  expect(functions.find(fn => fn.route === '/test-trigger')).toBeDefined();

  await sleep(50);

  // check logs
  const logs = getLogsForFunction(triggerHandlerName);
  expect(logs).toHaveLength(1);
  expect(logs.find(l => l.includes('{"count":false}'))).toBeDefined();

  done();
});

test('Should update existing trigger function', async done => {
  // copy test folder to existing
  const srcPath = path.join(installFolder, triggerUpdateFolder);
  const destPath = path.join(faasFolder, triggerUpdateFolder);
  await fse.copy(srcPath, destPath);

  // register new function
  await registerFunction({faasFolder, folder: triggerUpdateFolder});

  const functions = listFunctions({functionToContainerFormat: fn => fn});
  expect(functions).toHaveLength(4);
  expect(functions.find(fn => fn.route === '/test-trigger')).toBeDefined();

  await sleep(50);

  const logs = getLogsForFunction(triggerHandlerName);
  expect(logs).toHaveLength(2);
  expect(logs.find(l => l.includes('{"count":1}'))).toBeDefined();

  done();
});

test('Should remove existing trigger function', async done => {
  await removeFunction({id: 'test-trigger'});

  const functions = listFunctions({functionToContainerFormat: fn => fn});
  expect(functions).toHaveLength(3);
  expect(functions.find(fn => fn.route === '/test-trigger')).toBeUndefined();

  done();
});
