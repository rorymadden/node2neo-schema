'use strict';

var _ = require('underscore');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var setMaxListeners = EventEmitter.prototype.setMaxListeners;

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
  this._unique = options.unique || false;

  // set whether the options are strict
  this._strict = true;
  this._fields = [];

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

  // virtuals
  this._virtuals = [];
  this.statics = {};
  this._subSchemas = {};
  this._fieldValidators = {};
  this._schemaValidators = [];
  this._schemaPreparers = [];

  // set the fields if strict has been applied
  if(options && options.hasOwnProperty('strict')) this._strict = !!options.strict;
  // if(this._strict === true){
  //   this._fields = Object.keys(schema);
  // }

  // parse each schema type
  for(var field in schema){
    this.add(field, schema[field]);
  }

  EventEmitter.call(this);
  setMaxListeners.call(this, 0);


  return this;
}
util.inherits(Schema, EventEmitter);

/**
 * Add a field to a schema.
 * @param {String} fieldName The name of the field to be added
 * @param {Object} schema    The properties of the field e.g. {type:String, index:true} etc.
 */
Schema.prototype.add = function(fieldName, schema){
  var self = this;

  if(this._fields.indexOf(fieldName) === -1){
    this._fields.push(fieldName);
  }
  else {
    throw new Neo4jError('Invalid field. The requested field name ' + fieldName + ' already exists.');
  }

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
        self.unique(fieldName);
      }
      else {
        self.index(fieldName);
      }
    }

    else if(option === 'unique'){
      self.unique(fieldName);
    }

    else if (option === 'validate'){
      self._fieldValidators[fieldName] = schema[option];
    }

    // else if (option === 'prepare'){
    //   self.addPreparer(fieldName, schema[option]);
    // }

    else {
      // the option didn't match anything
      throw new Neo4jError('Invalid schema option for ' + fieldName + ': ' + option);
    }
  }
};

/**
 * Add an index to a field
 * @param  {String} field The name of the field to be indexed
 */
Schema.prototype.index = function(field){
  this._indexes.push(field);
};


/**
 * Add an index to a field
 * @param  {String} field The name of the field to be indexed
 */
Schema.prototype.unique = function(field){
  this._constraints.push(field);
};

/**
 * Add a custom validator for a field
 * @param {String} field     The name of the field
 * @param {Object} validator Validator and Message properties
 */
Schema.prototype.addValidator = function (validator) {
  // if it si a single function map it to an object
  if(typeof validator === 'function'){
    validator = {
      validator: validator
    };
  }
  // if there is no message
  if(!validator.message) validator.message = 'Invalid object';
  // if there is no code
  if(!validator.message) validator.code = 'Invalid object';
  //add to the validators object
  this._schemaValidators.push(validator);
};
/**
 * Add a custom preparer for a field
 * @param {String} field     The name of the field
 * @param {Function} preparer  The function to be performed
 */
Schema.prototype.addPreparer = function (preparer) {
  // if it si a single function map it to an object
  if(typeof validator === 'function'){
    throw new Neo4jError('Preparer must be a function.');
  }
  //add to the validators object
  this._schemaPreparers.push(preparer);
};

/**
 * Validate a schema. This ensures that all of the preparations (lowercases, trim) and
 * validations (required, match etc.) are performed prior to saving to a database.
 * @param  {Object}   object   The data to be validated
 * @return {Object}            The updated data model for the object.
 */
Schema.prototype.validate = function(object){
  // strip undefined fields
  for(var field in object){
    if(typeof object[field] === 'undefined'){
      delete object[field];
    }
  }


  //identify if there are any sub-schemas
  var subFields = Object.keys(this._subSchemas);
  var populatedFields = Object.keys(object);

  var self = this;


  var populatedSubSchemas = _.intersection(populatedFields, subFields);
  try {
    populatedSubSchemas.forEach(function(element){
      if(Array.isArray(object[element])){
        object[element].forEach(function(subelement, index){
          object[element][index] = self.validate.apply(self._subSchemas[element].schema, [object[element][index]]);
          if(object[element][index] instanceof Error) throw object[element][index];
        });
      }
      else{
        object[element] = self.validate.apply(self._subSchemas[element].schema, [object[element]]);
        if(object[element] instanceof Error) throw object[element];
      }
    });
  } catch(e){
    return e;
  }

  // populate default values
  for(var field in this._defaults){
    if(object[field] === null || object[field] === undefined){
      if(typeof this._defaults[field] === 'function'){
        object[field] = this._defaults[field]();
      }
      else object[field] = this._defaults[field];
    }
  }

  //perform custom preparations
  this._schemaPreparers.forEach(function(preparer){
    object = preparer(object);
  });

  // check required fields
  var populatedRequired = _.intersection(this._required, populatedFields);
  if(this._required.length !== populatedRequired.length){
    var gap = _.difference(this._required, populatedRequired);
    return new ValidationError('You are missing required field(s): ' + gap.toString());
  }

  // calculate the virtuals
  this._virtuals.forEach(function(element, index, array){
    // if the field exists as a set value do not overwrite it
    if(!object[element]){
      object[element.name] = element.get(object);
    }
  });


  for(var field in object){
    var value = object[field];

    // validate fields against strict mode
    if(this._strict && this._fields.indexOf(field) === -1){
      return new ValidationError(field + ' does not exist in the definition for ' + this.label);
    }

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
        return new CastError('date', value);

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
        return new CastError('number', value);

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
        return new CastError('string', value);
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
          return new ValidationError(field + ': ' + value + ' is less than the minimum of ' + this._number[field].min);
        }
      }
      if(this._number[field].max){
        if(value >= this._number[field].max) {
          return new ValidationError(field + ': ' + value + ' is greater than the maximum of ' + this._number[field].max);
        }
      }
    }

    // perform validations: enum
    if(Object.keys(this._enum).indexOf(field) !== -1){
      if(value !== undefined && this._enum[field].indexOf(value) === -1){
        return new ValidationError(field + ': ' + value + ' is not in the required list - ' + this._enum[field].toString());
      }
    }
    // perform validation: match
    if(Object.keys(this._match).indexOf(field) !== -1){
      if(value != null && value !== ''){
        if(!this._match[field].test(value)){
          return new ValidationError(field + ': ' + value + ' does not match the required pattern');
        }
      }
    }
    // perform custom validations
    if(Object.keys(this._fieldValidators).indexOf(field) !== -1){
      if(!this._fieldValidators[field](object[field])) {
        return new ValidationError(value + ' is not a valid option for ' + field);
      }
    }

  }

  //run final custom schema validators
  for(var i = 0, len = this._schemaValidators.length; i< len; i++) {
    var result = this._schemaValidators[i].validator(object);
    if(result === false) {
      return new ValidationError(this._schemaValidators[i].code, this._schemaValidators[i].message);
    }
  }
  // it made it to the end without an error
  return object;
};


/**
 * Create a virtual computed field. These are not stored in teh database but are calculated and returned on request of a node.
 * @param  {String} name    The name of the field
 * @param  {Object} options An onject with a get attribute which contains a function
 * @return {Null}
 */
Schema.prototype.virtual = function(name, options) {
  if(!options || typeof options.get !== 'function'){
    throw new Neo4jError('Invalid Virtual Format. You must provide a name and an options object with a get parameter.')
  }
  if(this._fields.indexOf(name) !== -1){
    throw new Neo4jError('Invalid subschema. The requested field name: ' + name + ' already exists.');
  }
  this._virtuals.push({
    name: name,
    get: options.get,
    set: options.set
  });
  this._fields.push(name);
};

/**
 * Adds static "class" methods to Models compiled from this schema.
 *
 * ####Example
 *
 *     var schema = new Schema(..);
 *     schema.static('findByName', function (name, callback) {
 *       return this.find({ name: name }, callback);
 *     });
 *
 *     var Drink = mongoose.model('Drink', schema);
 *     Drink.findByName('sanpellegrino', function (err, drinks) {
 *       //
 *     });
 *
 * If a hash of name/fn pairs is passed as the only argument, each name/fn pair will be added as statics.
 *
 * @param {String} name
 * @param {Function} fn
 * @api public
 */

Schema.prototype.static = function(name, fn) {
  if ('string' != typeof name)
    throw new Neo4jError('You must provide a name for the static function');
  else
    this.statics[name] = fn;
  return this;
};

/**
 * Registers a plugin for this schema.
 *
 * module.exports = function lastModifiedPlugin (schema, options) {
 *  schema.add(lastMod, { type: Date })
 *
 *  if (options && options.unique) {
 *   schema.unique('lastMod')
 *  }
 *
 *  if (options && options.index) {
 *   schema.index('lastMod')
 *  }
 * }
 *
 * var lastMod = require('./lastMod');
 * var Game = new Schema({ ... }, {label: Game});
 * Game.plugin(lastMod, { index: true });
 *
 * Schemas aren't saved directly so to add hooks you must add them to a model.
 *
 * @param {Function} plugin callback
 * @param {Object} opts
 * @api public
 */

Schema.prototype.plugin = function (fn, opts) {
  fn(this, opts);
  return this;
};


/**
 * Add subschemas to a schema
 *
 * var tag = new Schema({
 *  name: String,
 *  date: Date
 * }, {label: 'Tag'});
 *
 * var story = new Schema({
 *  title: String,
 *  content: String
 * }, {label"' Story'});
 *
 * story.subSchema(tag, 'tags', 'tagged');
 *
 * var story1 = {
 *   title: 'New Story',
 *   content: 'Once upon a time...',
 *   tags: [{name: 'Fairy Tale', date: Date.now() },
 *          {name: 'Disney', date: new Date(1910, 1, 1)}]
 * };
 *
 * @param  {Schema} schema       The sub-schema
 * @param  {String} fieldName    The name that the sub-schemas will be referenced under
 * @param  {String} relationship The name of the relationship between the schemas
 * @return {[type]}              [description]
 */
Schema.prototype.subSchema = function(schema, fieldName, relationship){
  if(arguments.length < 3){
    throw new Neo4jError('Invalid subschema. You must provide a schema, field name and a relationship label.');
  }
  if(!(schema instanceof Schema)){
    throw new Neo4jError('Invalid subschema: schema must be an instance of a Schema.');
  }
  if(this._fields.indexOf(fieldName) !== -1){
    throw new Neo4jError('Invalid subschema. The requested field name ' + fieldName + ' already exists.');
  }
  if(this._subSchemas[fieldName]){
    throw new Neo4jError('Invalid subschema. The requested subSchema ' + fieldName + ' already exists.');
  }
  this._fields.push(fieldName);
  this._subSchemas[fieldName] = { schema: schema, relationship: relationship};
};

Schema.error = Neo4jError;

module.exports = Schema;
