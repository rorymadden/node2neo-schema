/*!
 * Module dependencies.
 */

var Neo4jError = require('../error');

/**
 * Schema validator error
 *
 * @param {String} path
 * @param {String} msg
 * @inherits Neo4jError
 * @api private
 */

function ValidatorError (path, type) {
  var msg = type
    ? '"' + type + '" '
    : '';
  Neo4jError.call(this, 'Validator ' + msg + 'failed for path ' + path);
  Error.captureStackTrace(this, arguments.callee);
  this.name = 'ValidatorError';
  this.path = path;
  this.type = type;
};

/*!
 * toString helper
 */

ValidatorError.prototype.toString = function () {
  return this.message;
}

/*!
 * Inherits from Neo4jError
 */

ValidatorError.prototype.__proto__ = Neo4jError.prototype;

/*!
 * exports
 */

module.exports = ValidatorError;
