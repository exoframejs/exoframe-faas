// export faas methods
const {getLogsForFunction, listFunctions, registerFunction, removeFunction, setup} = require('./src/index');
const template = require('./src/template');

module.exports = {
  // logs
  getLogsForFunction,
  // listing
  listFunctions,
  // function registration and removal
  registerFunction,
  removeFunction,
  // init & middleware setup
  setup,
  // exoframe template
  template,
};
