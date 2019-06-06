module.exports = async (event, {log}) => {
  log('Worker started.');
  let counter = 0;
  setInterval(() => {
    log(`Worker: ${counter++}`);
  }, 1000);
};
