module.exports = async (event, {log}) => {
  log('Updated worker started.');
  let counter = 0;
  setInterval(() => {
    log(`Worker updated: ${counter++}`);
  }, 1000);
};
