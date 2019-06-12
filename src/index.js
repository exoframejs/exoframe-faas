const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const messageBus = require('./messagebus');
const runInWorker = require('./worker');

// loaded functions storage
const functions = {};

// remove function
const rmDir = path => new Promise(resolve => rimraf(path, resolve));

// basic logging function generator
const loggerForRoute = route => msg => functions[route].log.push(`${new Date().toISOString()} ${msg}\n`);

// noop cleanup function
const noopCleanup = async () => {};

exports.listFunctions = ({functionToContainerFormat}) =>
  Object.keys(functions).map(route =>
    functionToContainerFormat({config: functions[route].config, route, type: functions[route].type})
  );

exports.getLogsForFunction = id => {
  const route = Object.keys(functions).find(route => functions[route].name === id);
  const fn = functions[route];
  if (!fn) {
    return;
  }
  return fn.log;
};

exports.removeFunction = async ({id, username}) => {
  const route = Object.keys(functions).find(route => functions[route].name === id);
  const fn = functions[route];
  if (!fn) {
    return false;
  }

  // trigger cleanup
  await fn.cleanup();

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
    name: funConfig.name,
    type: config.type,
    route: config.route,
    handler: fun,
    config: funConfig,
    folder: funPath,
    log: [],
    cleanup: noopCleanup,
  };

  // create function context
  const context = {meta: functions[config.route], log: loggerForRoute(config.route)};

  // we're done if it's http function
  if (config.type === 'http') {
    return;
  }

  // if function is worker type - spawn new worker thread with it
  if (config.type === 'worker') {
    const worker = runInWorker(context);
    functions[config.route].worker = worker;
    functions[config.route].cleanup = () => worker.terminate();
    return;
  }

  // if function is a trigger - create new event subscription
  if (config.type === 'trigger') {
    const triggerName = functions[config.route].name;
    // create new function that emits trigger event for current function
    const emitTrigger = data => messageBus.emit(triggerName, data);
    // instantiate new trigger
    const triggerCleanup = await functions[config.route].handler(emitTrigger, context);
    // register new listeren for the trigger
    const handleTrigger = data => {
      Object.keys(functions)
        // find all function of current type
        .filter(key => functions[key].type === triggerName)
        // call them with new data
        .forEach(key => {
          const localContext = {meta: functions[key], log: loggerForRoute(functions[key].route)};
          functions[key].handler({data}, localContext);
        });
    };
    messageBus.addListener(triggerName, handleTrigger);
    functions[config.route].cleanup = async () => {
      // remove event listener
      messageBus.removeListener(triggerName, handleTrigger);
      // call cleanup
      if (triggerCleanup) {
        await triggerCleanup();
      }
    };
  }

  // Custom or unknown function type. No need to do anything..
};

const loadFunctions = faasFolder => {
  const folders = fs.readdirSync(faasFolder);
  for (const folder of folders) {
    exports.registerFunction({faasFolder, folder});
  }
};

exports.setup = ({faasFolder}) => {
  // load current functions
  loadFunctions(faasFolder);
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
