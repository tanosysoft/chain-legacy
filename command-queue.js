'use strict';
let Q = require('q');
let errorWithMetadata = require('./util/error-with-metadata');
let commandHandlers = {};
let errorHandler;
let interval;
let queue = [];
exports.setErrorHandler = function(handler) {
	errorHandler = handler;
};
exports.registerCommandHandler = function(name, handler) {
	commandHandlers[name] = handler;
};
exports.removeCommandHandler = function(name) {
	delete commandHandlers[name];
};
exports.registerCommandHandler('@function', function(fn, command) {
	return fn(command);
});
exports.enqueue = function() {
	let commands = [].slice.call(arguments);
	[].push.apply(queue, commands);
	let deferred = Q.defer();
	queue.push(function() {
		deferred.resolve();
		return 'done';
	});
	startIntervalIfNotActive();
	return deferred.promise;
};
function startIntervalIfNotActive() {
	if(interval) {
		return;
	}
	interval = setInterval(function() {
		if(queue.length === 0) {
			clearInterval(interval);
			interval = null;
			return;
		}
		let command = queue[0];
		if(typeof(command) !== 'object') {
			let commandObject = {};
			commandObject['@' + typeof(command)] = command;
			queue[0] = command = commandObject;
		}
		let commandName = Object.keys(command)[0];
		let mainCommandValue = command[commandName];
		let commandHandler = commandHandlers[commandName];
		let result = commandHandler(mainCommandValue, command);
		switch(result) {
			case 'yield':
				break;
			case 'done':
				queue.shift();
				break;
			default:
				dispatchOrThrow (
					errorWithMetadata (
						new Error (
							"Unexpected command handler result: '" + result + "'"
							+ " (command: '" + command + "')"
						), {
							command,
							commandHandler,
							queue,
						}
					)
				);
				break;
		}
	}, 0);
}
function dispatchOrThrow(error) {
	if(errorHandler) {
		errorHandler(error);
	}
	else {
		throw error;
	}
}