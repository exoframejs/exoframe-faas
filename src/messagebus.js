const EventEmitter = require('events');

const messageBus = new EventEmitter();

module.exports = messageBus;
