module.exports = async (dispatchEvent, {log}) => {
  log('Trigger started.');
  let counter = 0;
  let timeout = setTimeout(() => {
    dispatchEvent({count: ++counter});
    log(`Trigger done! {count: ${counter}}`);

    // new artificial timeout that prevents function from exiting
    timeout = setTimeout(() => {}, 10000);
  }, 10);

  return () => {
    clearTimeout(timeout);
  };
};
