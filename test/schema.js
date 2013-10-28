'use strict';

var Schema = require('../');
var should = require('chai').should();

var validateSchema, user;


describe("schema", function(){
  // Add your setup and assertions here
  // before(testDatabase.refreshDb);
  // after(testDatabase.stopDb);
  describe("schema population", function(){

    it("should create a simple schema", function(done){
      var userSchema = new Schema({first: String}, {label: 'User'});
      should.exist(userSchema instanceof Schema);
      userSchema._strict.should.equal(true);
      userSchema._types.first.should.equal('string');
      done();
    });
    it("should create a complex schema: one variable", function(done){
      var schema = {
        first: {type: String, required:true, trim:true, lowercase:true, match: /name/}
      }
      var userSchema = new Schema(schema, {label: 'User'});
      userSchema._strict.should.equal(true);
      userSchema._types.first.should.equal('string');
      userSchema._fields.should.contain('first');
      userSchema._required.should.contain('first');
      userSchema._string.first.should.contain('trim');
      userSchema._string.first.should.contain('lowercase');
      // userSchema._match.first.toString().should.match('/name/');
      done();
    });
    it("should create a complex schema: multiple variables", function(done){
      var GENDER = ['male', 'female'];
      var schema = {
        first: {type: String, required:true, trim:true, lowercase:true, match: /name/},
        age: {type: 'Number', min: 5, max: 10, required: true},
        gender: { type: String, enum: GENDER},
        other: {type: String, default: 'other'}
      }
      var userSchema = new Schema(schema, {label: 'User'});
      userSchema._strict.should.equal(true);
      userSchema._types.first.should.equal('string');
      userSchema._fields.should.contain('first');
      userSchema._required.should.contain('first');
      userSchema._string.first.should.contain('trim');
      userSchema._string.first.should.contain('lowercase');


      userSchema._types.age.should.equal('number');
      userSchema._fields.should.contain('age');
      userSchema._required.should.contain('age');
      userSchema._number.age.min.should.equal(5);
      userSchema._number.age.max.should.equal(10);

      userSchema._types.gender.should.equal('string');
      userSchema._fields.should.contain('gender');
      userSchema._enum.gender.should.equal(GENDER);

      userSchema._types.other.should.equal('string');
      userSchema._fields.should.contain('other');
      userSchema._defaults.other.should.equal('other');
      done();
    });
    it("should create a non-strict schema", function(done){
      var userSchema = new Schema({first: String}, {strict: false, label: 'User'});
      userSchema._strict.should.be.false;
      done();
    });
    it("should create a schema with virtuals", function(done){
      var schema = {
        first_name: String,
        last_name: String
      };
      var userSchema = new Schema(schema, {label: 'User'});
      userSchema.virtual('name', {
        get: function(obj){
          return obj.first_name + ' ' + obj.last_name;
        }
      });
      var user = {
        first_name: 'Rory',
        last_name: 'Madden'
      }
      var updatedUser = userSchema.validate(user);
      updatedUser.name.should.equal('Rory Madden');
      done();
    });
    it("should fail on invalid virtual definition", function(done){
      var schema = {
        first_name: String,
        last_name: String
      };
      var user = {
        first_name: 'Rory',
        last_name: 'Madden'
      }
      var userSchema = new Schema(schema, {label: 'User'});
      try{
        userSchema.virtual('name', {get: 'blue'});
      }
      catch(e){
        should.exist(e);
        e.message.should.equal('Invalid Virtual Format. You must provide a name and an options object with a get parameter.');
        done();
      }
    });
    it("should store static methods", function(done){
      var schema = new Schema({},{label:'Test'});
      schema.static('blue', function(){
        return 'blue';
      });
      should.exist(schema.statics.blue);
      schema.statics.blue().should.equal('blue');
      done();
    });
    it("should create a schema with subschemas", function(done){
      var tag = new Schema({
        name: String,
        date: Date
      }, {label: 'Tag'});

      var story = new Schema({
        title: String,
        content: String
      }, {label:' Story'});

      story.subSchema(tag, 'tags', 'tagged');
      should.exist(story._subSchemas.tags);
      story._subSchemas.tags.relationship.should.equal('tagged');
      story._subSchemas.tags.schema.should.equal(tag);
      done();
    });
  });
  describe("schema validation", function(){
    before(function(done){
      var GENDER = ['male', 'female'];
      var schema = {
        first: {type: String, required:true, trim:true, lowercase:true, match: /name/},
        age: {type: 'Number', min: 5, max: 90, required: true},
        gender: { type: String, enum: GENDER},
        other: {type: String, default: 'other'}
      };
      var userSchema = new Schema(schema, {label: 'User'});
      validateSchema = userSchema;
      done();
    });
    it("should fail on missing required field", function(done){
      user = {
        age: 30,
        gender: 'male'
      };
      var err = validateSchema.validate(user);
      (err instanceof Error).should.be.ok;
      err.message.should.equal('You are missing required field(s): first');
      done();
    });
    it("should fail on missing required fields", function(done){
      user = {
        gender: 'male'
      };
      var err = validateSchema.validate(user);
      (err instanceof Error).should.be.ok;
      err.message.should.equal('You are missing required field(s): first,age');
      done();
    });
    it("should fail on regex failure", function(done){
      user = {
        first: 'blue',
        age: 30,
        gender: 'male'
      };
      var err = validateSchema.validate(user);
      (err instanceof Error).should.be.ok;
      err.message.should.equal('first: blue does not match the required pattern');
      done();
    });
    it("should trim and lowercase", function(done){
      user = {
        first: ' NAme',
        age: 30,
        gender: 'male'
      };
      var userUpdated = validateSchema.validate(user);
      userUpdated.first.should.equal('name');
      done();
    });
    it("should fail on invalid number: below min", function(done){
      user = {
        first: 'name',
        age: 3,
        gender: 'male'
      };
      var err = validateSchema.validate(user);
      (err instanceof Error).should.be.ok;
      err.message.should.equal('age: 3 is less than the minimum of 5');
      done();
    });
    it("should fail on invalid number: above max", function(done){
      user = {
        first: 'name',
        age: 100,
        gender: 'male'
      };
      var err = validateSchema.validate(user);
      (err instanceof Error).should.be.ok;
      err.message.should.equal('age: 100 is greater than the maximum of 90');
      done();
    });
    it("should fail on enum", function(done){
      user = {
        first: 'name',
        age: 30,
        gender: 'lgbt'
      };
      var err = validateSchema.validate(user);
      (err instanceof Error).should.be.ok;
      err.message.should.equal('gender: lgbt is not in the required list - male,female');
      done();
    });
    it("should fail on enum", function(done){
      user = {
        first: 'name',
        age: 30,
        gender: 'female',
        bad: 'this'
      };
      var err = validateSchema.validate(user);
      (err instanceof Error).should.be.ok;
      err.message.should.equal('bad does not exist in the definition for User');
      done();
    });
    it("should fail with undefined required value", function(done){
      user = {
        first: undefined,
        age: 30,
        gender: 'male'
      }
      var err = validateSchema.validate(user);
      (err instanceof Error).should.be.ok;
      err.message.should.equal('You are missing required field(s): first');
      done();
    });
    it("should default values", function(done){
      var user = {
        first: 'name',
        age: 30,
        gender: 'male'
      }
      var updatedUser = validateSchema.validate(user);
      updatedUser.other.should.equal('other');
      done();
    });

    it("should not fail on a default of false", function(done){
      var schema = {
        name: {type: Boolean, default:false}
      }
      var boolSchema = new Schema(schema, {label: 'Bool'})
      var updatedBool = boolSchema.validate({});
      updatedBool.name.should.be.false;
      done();
    });
    it("should default values based on a function", function(done){
      var sample = Date.now();
      var schema = new Schema({
        dateNow: {type: Date, default: function(){
          return Date.now();
        }}
      }, {label: 'Test'});
      var updatedSchema = schema.validate({});
      updatedSchema.dateNow.should.be.least(sample);
      done();
    });
    it("should fail on invalid data type", function(done){
      var schema = {
        date: {type: Date}
      };
      var badSchema = new Schema(schema, {label: 'User'});
      var test = badSchema.validate({date: true});
      (test instanceof Error).should.be.ok;
      test.message.should.equal('Cast to date failed for value "true"');
      done();
    });
    it("should convert to boolean:true", function(done){
      var schema = {
        bool: {type: Boolean}
      };
      var badSchema = new Schema(schema, {label: 'User'});
      var test = badSchema.validate({bool: 'value'});
      test.bool.should.be.equal(true);
      done();
    });
    it("should convert to boolean:false", function(done){
      var schema = {
        bool: {type: Boolean}
      };
      var badSchema = new Schema(schema, {label: 'User'});
      var test = badSchema.validate({bool: 0});
      test.bool.should.be.equal(false);
      done();
    });
    it("should convert to array", function(done){
      var schema = {
        arr: {type: Array}
      };
      var badSchema = new Schema(schema, {label: 'User'});
      var test = badSchema.validate({arr: 'sample'});
      test.arr.should.be.an.instanceOf(Array);
      test.arr[0].should.be.equal('sample');
      done();
    });
    it("should fail on invalid number", function(done){
      var schema = {
        num: {type: Number}
      };
      var badSchema = new Schema(schema, {label: 'User'});
      var test = badSchema.validate({num: 'sample'});
      (test instanceof Error).should.be.ok;
      test.message.should.equal('Cast to number failed for value "sample"');
      done();
    });
    it("should convert string to number", function(done){
      var schema = {
        num: {type: Number}
      };
      var badSchema = new Schema(schema, {label: 'User'});
      var test = badSchema.validate({num: '3'});
      test.num.should.equal(3);
      done();
    });
    it("should convert empty string to null", function(done){
      var schema = {
        num: {type: Number}
      };
      var badSchema = new Schema(schema, {label: 'User'});
      var test = badSchema.validate({num: ''});
      should.not.exist(test.num);
      done();
    });
  });
  describe("indexing", function(){
    it("should populate the indexes object", function(done){
      var GENDER = ['male', 'female'];
      var schema = {
        first: {type: String, required:true, trim:true, lowercase:true, match: /name/, index: true},
        age: {type: 'Number', min: 5, max: 10, required: true, index: {unique: true}},
        gender: { type: String, enum: GENDER, index: true},
        other: {type: String, default: 'other', unique: true}
      };
      var userSchema = new Schema(schema, {label: 'User'});
      userSchema._indexes.should.contain('first');
      userSchema._indexes.should.contain('gender');
      userSchema._constraints.should.contain('age');
      userSchema._constraints.should.contain('other');
      done();
    });
  });
  describe("sub schemas", function(){
    var tag, story, category;
    before(function(){
      category = new Schema({name: {type: String, required:true}, other: String}, {label: 'Category'});
      tag = new Schema({
        name: {type: String, required: true},
        date: Date
      }, {label: 'Tag'});

      tag.subSchema(category, 'category', 'CATEGORY')

      story = new Schema({
        title: {type: String, required: true},
        content: String
      }, {label:' Story'});

      story.subSchema(tag, 'tags', 'TAGGED');
    });
    it("should validate correctly", function(done){
      var story1 = {
        title: 'Story',
        content: 'Once upon a time',
        tags: [{
          name: 'fairytale',
          category: {name: 'cat1'}
        },{
          name: 'other',
          category: {name: 'cat2'}
        }]
      };
      var updatedStory = story.validate(story1);
      updatedStory.title.should.equal(story1.title);
      updatedStory.content.should.equal(story1.content);
      updatedStory.tags[0].name.should.equal(story1.tags[0].name);
      updatedStory.tags[1].name.should.equal(story1.tags[1].name);
      done();
    });
    it("should fail validation: main node", function(done){
      var story1 = {
        content: 'Once upon a time',
        tags: [{
          name: 'fairytale',
          category: {name: 'cat1'}
        },{
          name: 'other',
          category: {name: 'cat2'}
        }]
      };
      var updatedStory = story.validate(story1);
      (updatedStory instanceof Error).should.be.ok;
      done();
    });
    it("should fail validation: sub node", function(done){
      var story1 = {
        title: 'Story',
        content: 'Once upon a time',
        tags: [{
          category: {name: 'cat1'}
        },{
          name: 'other',
          category: {name: 'cat2'}
        }]
      };
      var updatedStory = story.validate(story1);
      (updatedStory instanceof Error).should.be.ok;
      done();
    });
    it("should fail validation: sub-sub node", function(done){
      var story1 = {
        title: 'Story',
        content: 'Once upon a time',
        tags: [{
          name: 'fairytale',
          category: {other: 'test'}
        },{
          name: 'other',
          category: {name: 'cat2'}
        }]
      };
      var updatedStory = story.validate(story1);
      (updatedStory instanceof Error).should.be.ok;
      done();
    });
  });
  describe('custom validators and preparers', function () {
    it('should perform a custom preparer', function (done) {
      var prepSchema = new Schema({
        year: Number,
        month: Number,
        day: Number,
        timestamp: Date,
        approximate: Boolean
      }, {label: 'prepSchema'});

      prepSchema.addPreparer(function(obj){
        if(!obj.year || !obj.month || !obj.day){
          obj.approximate = true;
        }
        else {
          obj.timestamp = new Date(obj.year, obj.month, obj.day);
        }
        return obj;
      })
      prepSchema._schemaPreparers.should.have.length(1);
      var withTime = prepSchema.validate({year: 2012, month: 6, day: 12});
      should.exist(withTime.timestamp);
      var approx = prepSchema.validate({year: 2012});
      should.exist(approx.approximate);
      should.not.exist(approx.timestamp);
      done();
    });
    it('should perform a custom validation', function (done) {
      var valSchema = new Schema({
        year: Number,
        month: Number,
        day: Number,
        timestamp: Date,
        approximate: Boolean
      }, {label: 'valSchema'});

      valSchema.addValidator(function(obj){
        if(!obj.year || !obj.month || !obj.day){
          return false;
        }
        else {
          return true;
        }
      })
      valSchema._schemaValidators.should.have.length(1);
      var valid = valSchema.validate({year: 2012, month: 6, day: 12});
      (valid instanceof Error).should.not.be.ok;
      var invalid = valSchema.validate({year: 2012});
      (invalid instanceof Error).should.be.ok;
      done();
    });
  });
});