# Node2Neo Schema

Schema support for Node2Neo models

This is intended to be used with the node2neo modules but it is generic to be used for any purposes

NOTE: Neo4j 2.0 is required.

## Installation

    npm install node2neo-schema

## Usage

#### Define a schema

```js
var Schema = require('node2neo-schema');

var rawUserSchema = {
  first: {type: String, required: true, trim: true, match: /name/},
  birthday: Date,
  likes: Array,
  alive: {type: Boolean, default: true},
  age: {type: Number, min:5, max:90}
  gender: {type:String, enum:['male', 'female']}
}

var options = {label: 'User'};

var userSchema = new Schema(rawUserSchema, options);

})
```

Schemas support the following data types:
1. String
2. Number
3. Date
4. Array
5. Boolean

The following options are available for each schema item:
1. required
2. default (can be a function or a value)
3. match (supply a regular expression)
4. String: lowercase, uppercase, trim, enum
5. Number: min, max

Schemas can be defined to be strict or not, by default schemas are strict. If you pass in a strict:false value in the option the schema will not be strict. Strict means that only the fields defined in the schema can be saved. Any new fields will fail validation.

```js
var options = {
  label: 'User',
  strict: false
}
```
#### Static Methods
You can add static methods to a schema.

```js
var schema = new Schema({
  name: String
}, {label: 'Blue'});

schema.static('turnBlue', function(obj){
  obj.name = 'blue';
  return obj;
});

//using node2neo models
var m = Model.model('Blue', schema);
var sample = {name: 'Green'};
sample = m.turnBlue(sample); // sample.namenow equals blue;
```


#### Validation
The main point of defining a schema is for hassle free validation.

``js
var newUser = {
  first: 'Name',
  age: 30
}

userSchema.validate(newUser, function(err, user){
  // user object will be different if transform methods used e.g. cast to type, trim etc.
})
```

The following validations/mainpulations are performed:
1. Cast to Type
Changes input into the desired object type. Will fail if an invalid type is supplied (e.g. if a value is supoed to be a date and you pass 'blue' into the field)
2. String manipulation (trim, ,uppercase, lowercase)
3. Number validation (min, max)
4. Enum validation
5. Regular expression validation
6. Strict schema validation
Will error if a field is attempted to be save and is not defined in the schema

The validation will return on the first error. I'm open to change on this so let me know if you would prefer an array of all errors.

#### Indexes
You can supply indexes to a schema. This module is database independent so they will not be applied but will be available to be created.


```js
var rawSchema = {
  first: {type: String, index: true},
  last: {type: String, unique: true},
  email: {type: String, index: {unique: true}},
}
var options = {label: 'User'}

userSchema = new Schema(rawSchema, options)
```

The structure of the userSchema response is as follows:
```js
{
  _strict = true || false;
  _fields = undefined || [];

  //validation options
  _defaults = {
    alive: true
  };
  _required = ['first', 'email'];
  _types = {
    first: 'string'
  };
  _enum = {
    gender: ['male', 'female']
  };
  _match = {
    email: /email/
  };
  _number = {
    age: {
      min: 5,
      max: 90
    }
  };
  _string = {
    first: ['trim', 'lowercase']
  };

  // to store transactions for indexes/constraints
  _indexes = ['email'];
  _constraints = ['securityNumber'];
  _appliedConstraints = []; // this is used as Neo4j errors if you attempt to re-apply a constraint
  _appliedIndexes = [];
}
```

##Licence
MIT