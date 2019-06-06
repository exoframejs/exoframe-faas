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
const folder = 'test-worker-fn';
const updateFolder = 'test-worker-up-fn';

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
  const srcPath = path.join(installFolder, folder);
  const destPath = path.join(faasFolder, folder);
  await fse.copy(srcPath, destPath);

  // register new function
  await registerFunction({faasFolder, folder});

  const functions = listFunctions({functionToContainerFormat: fn => fn});
  expect(functions).toHaveLength(3);
  expect(functions.find(fn => fn.route === '/test-worker-fn')).toBeDefined();

  done();
});

test('Should update existing function', async done => {
  // copy test folder to existing
  const srcPath = path.join(installFolder, updateFolder);
  const destPath = path.join(faasFolder, updateFolder);
  await fse.copy(srcPath, destPath);

  // register new function
  await registerFunction({faasFolder, folder: updateFolder});

  const functions = listFunctions({functionToContainerFormat: fn => fn});
  expect(functions).toHaveLength(3);
  expect(functions.find(fn => fn.route === '/test-worker-fn')).toBeDefined();

  await sleep(500);

  const logs = getLogsForFunction(folder);
  expect(logs.find(l => l.includes('Updated worker started'))).toBeDefined();

  done();
});

test('Should remove existing function', async done => {
  await removeFunction({id: folder});

  const functions = listFunctions({functionToContainerFormat: fn => fn});
  expect(functions).toHaveLength(2);
  expect(functions.find(fn => fn.route === '/test-worker-fn')).toBeUndefined();

  done();
});
