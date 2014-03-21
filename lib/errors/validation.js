
/*!
 * Module requirements
 */

var Neo4jError = require('../error')

/**
 * Document Validation Error
 *
 * @api private
 * @param {Document} instance
 * @inherits Neo4jError
 */

function ValidationError (code, msg) {
  Neo4jError.call(this, code, msg);
  Error.captureStackTrace(this, arguments.callee);
  this.name = 'ValidationError';
};

/**
 * Console.log helper
 * @api private
 */

ValidationError.prototype.toString = function () {
  return this.name + ': ' + Object.keys(this.errors).map(function (key) {
    return String(this.errors[key]);
  }, this).join(', ');
};

/*!
 * Inherits from Neo4jError.
 */

ValidationError.prototype.__proto__ = Neo4jError.prototype;

/*!
 * Module exports
 */

module.exports = exports = ValidationError;
