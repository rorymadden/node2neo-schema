'use strict';

var _ = require('underscore');
var CastError = require('./errors/cast');
var ValidationError = require('./errors/validation');
var Neo4jError = require('./error');


function Schema (schema, options){
  if(!options || !options.label){
    throw new Neo4jError('You must provide a label to a schema in the options.');

  }
  if(typeof schema !== 'object' ) {
    throw new Neo4jError('Schema must be an object');
  }

  this.label = options.label;

  // set whether the options are strict
  this._strict = true;
  this._fields = undefined;

  //validation options
  this._defaults = {};
  this._required = [];
  this._types = {};
  this._enum = {};
  this._match = {};
  this._number = {};
  this._string = {};

  // to store transactions for indexes/constraints
  this._indexes = [];
  this._constraints = [];
  this._appliedConstraints = [];
  this._appliedIndexes = [];


  // set the fields if strict has been applied
  if(options && options.hasOwnProperty('strict')) this._strict = !!options.strict;
  if(this._strict === true){
    this._fields = Object.keys(schema);
  }

  // parse each schema type
  for(var field in schema){
    parseschema(this, this.label, field, schema[field]);
  }

  return this;

  // if we have to process some transactions
  // TODO: move this to Model
  // applyTransaction(this, callback);
}

var parseschema = function(self, label, fieldName, schema){

  // if the only option is the type then update it
  // e.g. field: string -> field: { type: String }
  if(typeof schema === 'string' || typeof schema === 'function'){
    schema = {
      type: schema
    };
  }

  // available options: type, required, index, trim, uppercase, lowercase, match, default, enum, unique, min, max
  for(var option in schema){
    option = option.toLowerCase().trim();
    // prepare values
    if(option === 'type'){
      var type = schema[option];
      if(typeof type === 'function') {
        var typeFunc = schema[option].toString();
        type = typeFunc.substring(9, typeFunc.indexOf('('));
      }
      self._types[fieldName] = type.toLowerCase();
    }

    else if(option === 'default'){
      self._defaults[fieldName] = schema[option];
    }

    else if(option === 'trim' || option === 'uppercase' || option === 'lowercase'){
      if(!self._string[fieldName]) self._string[fieldName] = [];
      self._string[fieldName].push(option);
    }

    // perform validations
    else if(option === 'required'){
      self._required.push(fieldName);
    }

    else if(option === 'match'){
      self._match[fieldName] = schema[option];
    }

    else if(option === 'enum'){
      self._enum[fieldName] = schema[option];
    }

    else if(option === 'min' || option === 'max'){
      if(!self._number[fieldName]) self._number[fieldName] = {};
      self._number[fieldName][option] = schema[option];
    }

    // apply indexes
    // TODO: re-add these in - requires label index approach
    else if(option === 'index'){
      if(schema[option].unique){
        self._constraints.push(fieldName);
      }
      else self._indexes.push(fieldName);
    }

    else if(option === 'unique'){
      self._constraints.push(fieldName);
    }

    else {
      // the option didn't match anything
      throw new Neo4jError('Invalid schema option for ' + fieldName + ': ' + option);
    }
  }
};


var setContraints = function(self, label, field){
  self._constraints[field] = 'CREATE CONSTRAINT ON (node:' + label + ') ASSERT node.' + field + ' IS UNIQUE';
};

var setIndex = function(self, label, field){
  self._indexes[field] = 'CREATE INDEX ON :' + label + '(' + field +')';
};



Schema.prototype.validate = function(object, callback){
  var populatedFields = Object.keys(object);

  // populate default values
  for(var field in this._defaults){
    if(object[field] === null || object[field] === undefined){
      object[field] = this._defaults[field];
    }
  }



  // check required fields
  var populatedRequired = _.intersection(this._required, populatedFields);
  if(this._required.length !== populatedRequired.length){
    var gap = _.difference(this._required, populatedRequired);
    return callback(new ValidationError('You are missing required field(s): ' + gap.toString()));
  }



  for(var field in object){
    var value = object[field];


    // check field types
    var type = this._types[field];
    if(type != null && value != null){
      switch (type) {

      // if the type is a date return a date version
      case 'date':
        if (value === null || value === '')
          break;

        if (value instanceof Date) {
          object[field] = value.getTime();
          break;
        }

        var date;
        // support for timestamps
        if (value instanceof Number || 'number' === typeof value || String(value) === Number(value)){
          date = new Date(Number(value));
        }

        // support for date strings
        else if (value.toString){
          date = new Date(value.toString());
        }

        if (date.toString() !== 'Invalid Date'){
          object[field] = date.getTime();
          break;
        }
        return callback(new CastError('date', value));

      // if the type is a boolean return a boolean version
      case 'boolean':
        if (value === null) {
          break;
        }
        if (value === '0') {
          object[field] = false;
          break;
        }
        object[field] = !!value;
        break;

      // if the type is an array return an array version
      case 'array':
        if (Array.isArray(value)){
          break;
        }
        object[field] = [value];
        break;

      // if the type is a number return a number version
      case 'number':
        if (!isNaN(value)){
          if (null === value){
            object[field] = value;
            break;
          }
          if ('' === value){
            object[field] = null;
            break;
          }
          if ('string' === typeof value) value = Number(value);
          if (value instanceof Number){
            object[field] = value;
            break;
          }
          if ('number' === typeof value) {
            object[field] = value;
            break;
          }
          if (value.toString && !Array.isArray(value) &&
              value.toString() === Number(value)) {
            object[field] =  new Number(value);
            break;
          }
        }
        return callback(new CastError('number', value));

      // if the type is a string return a string version
      case 'string':
        if (value === null) {
          object[field] = value;
          break;
        }
        if ('undefined' !== typeof value && value.toString) {
          object[field] = value.toString();
          break;
        }
        return callback(new CastError('string', value));
      }
    }


    // perform updates: string (trim, upper, lower)
    if(Object.keys(this._string).indexOf(field) !== -1){
      if(this._string[field].indexOf('lowercase') !== -1) value = value.toLowerCase();
      if(this._string[field].indexOf('uppercase') !== -1) value = value.toUpperCase();
      if(this._string[field].indexOf('trim') !== -1) value = value.trim();
      object[field] = value;
    }

    // perform validations: number (min, max)
    if(Object.keys(this._number).indexOf(field) !== -1){
      if(this._number[field].min){
        if(value <= this._number[field].min) {
          return callback(new ValidationError(field + ': ' + value + ' is less than the minimum of ' + this._number[field].min));
        }
      }
      if(this._number[field].max){
        if(value >= this._number[field].max) {
          return callback(new ValidationError(field + ': ' + value + ' is greater than the maximum of ' + this._number[field].max));
        }
      }
    }

    // perform validations: enum
    if(Object.keys(this._enum).indexOf(field) !== -1){
      if(value !== undefined && this._enum[field].indexOf(value) === -1){
        return callback(new ValidationError(field + ': ' + value + ' is not in the required list - ' + this._enum[field].toString()));
      }
    }
    // perform validation: match
    if(Object.keys(this._match).indexOf(field) !== -1){
      if(value != null && value !== ''){
        if(!this._match[field].test(value)){
          return callback(new ValidationError(field + ': ' + value + ' does not match the required pattern'));
        }
      }
    }

    if(this._strict && this._fields.indexOf(field) === -1){
      return callback(new ValidationError(field + ' does not exist in the definition for ' + this.label));
    }
  }
  // it made it to the end without an error
  return callback(null, object);
};

Schema.error = Neo4jError;

module.exports = Schema;
