module.exports = async (dispatchEvent, {log}) => {
  log('Trigger started.');
  let timeout = setTimeout(() => {
    log(`Trigger done! {count: false}`);
    dispatchEvent({count: false});

    // new artificial timeout that prevents function from exiting
    timeout = setTimeout(() => {}, 10000);
  }, 10);

  return () => {
    clearTimeout(timeout);
  };
};
