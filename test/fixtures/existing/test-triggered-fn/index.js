/* eslint-env jest */
module.exports = async ({data}, {log}) => {
  log(`Test triggered: ${JSON.stringify(data)}`);
};
