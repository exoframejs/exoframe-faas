const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const runInWorker = require('./worker');

// loaded functions storage
const functions = {};

// remove function
const rmDir = path => new Promise(resolve => rimraf(path, resolve));

// basic logging function generator
const loggerForRoute = route => msg => functions[route].log.push(`${new Date().toISOString()} ${msg}\n`);

exports.listFunctions = ({functionToContainerFormat}) =>
  Object.keys(functions).map(route =>
    functionToContainerFormat({config: functions[route].config, route, type: functions[route].type})
  );

exports.getLogsForFunction = id => {
  const route = Object.keys(functions).find(route => functions[route].config.name === id);
  const fn = functions[route];
  if (!fn) {
    return;
  }
  return fn.log;
};

exports.removeFunction = async ({id, username}) => {
  const route = Object.keys(functions).find(route => functions[route].config.name === id);
  const fn = functions[route];
  if (!fn) {
    return false;
  }

  // if running in worker - trigger cleanup
  if (fn.type === 'worker') {
    fn.worker.terminate();
  }

  // remove from cache
  delete functions[route];
  // remove files
  await rmDir(fn.folder);

  return true;
};

exports.registerFunction = async ({faasFolder, folder}) => {
  // ignore empty current folder reference
  if (!folder || !folder.trim().length) {
    return;
  }
  // construct paths
  const funPath = path.join(faasFolder, folder);
  const funConfigPath = path.join(funPath, 'exoframe.json');
  // load code and config
  const fun = require(funPath);
  const funConfig = require(funConfigPath);
  // expand config into default values
  const config = {route: `/${funConfig.name}`, type: 'http', ...funConfig.function};

  // if function already exists - remove old version
  if (functions[config.route]) {
    await exports.removeFunction({id: funConfig.name});
  }

  // store function in memory
  functions[config.route] = {
    type: config.type,
    route: config.route,
    handler: fun,
    config: funConfig,
    folder: funPath,
    log: [],
  };

  // we're done if it's http function
  if (config.type === 'http') {
    return;
  }

  // otherwise - execute work based on function
  if (config.type === 'worker') {
    const worker = runInWorker({meta: functions[config.route], log: loggerForRoute(config.route)});
    functions[config.route].worker = worker;
    return;
  }

  throw new Error(`Unknown function type! Couldn't register ${functions[config.route]}!`);
};

const loadFunctions = faasFolder => {
  const folders = fs.readdirSync(faasFolder);
  for (const folder of folders) {
    exports.registerFunction(folder);
  }
};

exports.setup = config => {
  // load current functions
  loadFunctions(config.faasFolder);
  // return new fastify middleware
  return (fastify, opts, next) => {
    // http handler
    fastify.route({
      method: 'GET',
      path: '*',
      async handler(request, reply) {
        const route = request.params['*'];
        if (functions[route] && functions[route].type === 'http') {
          const event = request;
          const context = {reply, log: loggerForRoute(route)};
          const res = await functions[route].handler(event, context);
          if (res) {
            reply.send(res);
          }
          return;
        }

        reply.code(404).send(`Error! Function not found!`);
      },
    });

    next();
  };
};
