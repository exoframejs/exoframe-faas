const path = require('path');
const {Worker} = require('worker_threads');

module.exports = ({meta, log}) => {
  const file = path.join(meta.folder, 'index.js');
  const runner = path.join(__dirname, 'runner.js');
  const worker = new Worker(runner, {
    workerData: {file},
  });
  worker.on('message', msg => {
    log(msg);
  });
  worker.on('error', err => {
    log(err);
  });
  worker.on('exit', code => {
    log(`Worker stopped with exit code ${code}`);
  });
  return worker;
};
