/*!
 * Module dependencies.
 */

var Neo4jError = require('../error');

/**
 * Casting Error constructor.
 *
 * @param {String} type
 * @param {String} value
 * @inherits Neo4jError
 * @api private
 */

function CastError (type, value) {
  Neo4jError.call(this, 'Cast to ' + type + ' failed for value "' + value + '"');
  Error.captureStackTrace(this, arguments.callee);
  this.name = 'CastError';
  this.type = type;
  this.value = value;
};

/*!
 * Inherits from Neo4jError.
 */

CastError.prototype.__proto__ = Neo4jError.prototype;

/*!
 * exports
 */

module.exports = CastError;
