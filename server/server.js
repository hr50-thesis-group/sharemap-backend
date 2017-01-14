var express = require('express');
var path = require('path');
var neo4j = require('neo4j-driver').v1;
var uuidV1 = require('uuid/v1');
var helpers = require('./helpers.js');
var request = require('request');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
var bcrypt = require('bcrypt-nodejs');
var expressJWT = require('express-jwt');
var jwt = require('jsonwebtoken');

// .env access
require('dotenv').config();

// initialize aws s3 
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_ID,
  secretAccessKey: process.env.AWS_ACCESS_KEY,
});

// Initialize multers3 with our s3 config and other options
const upload = multer({
  storage: multerS3({
    s3,
    bucket: 'sharemap',
    acl: 'public-read',
    metadata(req, file, cb) {
      cb(null, {fieldName: file.fieldname});
    },
    key(req, file, cb) {
      cb(null, Date.now().toString() + '.png');
    }
  })
});

// START SERVER; CONNECT DATABASE
var app = express();
var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', '12345'));
var session = driver.session();

app.listen(1337, function() {
  console.log('Listening on port 1337');
});

app.use(jsonParser);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressJWT({ secret: process.env.JWT_SECRET })  
  .unless({
    path: [
      '/api/login',
      '/api/signup',
      '/api/users',
    ],
}));

app.get('/', function(req, res) {
  res.send('hi');
});

/* * * * * * * *
 *             *
 *  USERS API  *
 *             *
 * * * * * * * */

app.post('/api/signup', (req, res, next) => {
  let { email, password, firstName, lastName } = req.body;
  firstName = firstName || '';
  lastName = lastName || '';
  session.run (
    'MATCH (n:User)\
    WHERE n.email = {emailParam}\
    RETURN n',
    {emailParam: email}
  )
  .then(result => {
    console.log('is this thing on...?');
    if (result.records.length) {
      session.close();
      let error = 'Email has already been used. Please try again!';
      res.status(400).send({ error });
    } else {
      const saltRounds = 10;
      bcrypt.hash(password, null, null, (err, hash) => {
        if (err) {
          console.error('An error while hashing user\'s password');
          throw err;
        }
        let uniqueID = uuidV1();
        session
          .run('CREATE (n:User {\
            firstName : {firstNameParam},\
            lastName:{lastNameParam},\
            email:{emailParam},\
            id:{idParam},\
            password:{passwordParam}\
          }) RETURN n.firstName', {
            firstNameParam: firstName.toLowerCase(), 
            lastNameParam: lastName.toLowerCase(), 
            emailParam: email,  
            idParam: uniqueID,
            passwordParam: hash,
          })
          .then(result => {
            session.close();
            res.status(201).send({ success: 'Account was created, log in!' });
          })
          .catch(err => {
            session.close();
            console.log('POST /api/signup: An error occurred while creating a new user');
            console.log(err);
            throw err;
          });
      });
    }
  })
  .catch(error => {
    console.log(error);
    console.log('POST /api/signup: An error occurred querying an user');
    throw error;
  });
});

// Creates a new User
app.post('/api/users', function(req, res) {

  if (req.body.fbID) { // facebook login
    let { firstName, lastName, email, photoUrl, fbID } = req.body;
    let uniqueID = fbID;
    profileUrl = photoUrl;
    email = email || 'Facebook User';
            
    let userToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "24h"
    });
    let user = {
      userId: uniqueID,
      firstName,
      lastName,
      email,
      profileUrl,
      authToken: userToken,
    };
    session.run(
      'MATCH (n:User)\
      WHERE n.id = {idParam}\
      RETURN n',
      {idParam: uniqueID}
    )
    .then(result => {
      session.close();
      if (result.records.length) {
        // user already exists
        res.status(201).send({user});
      } else {
        // create a new user
        session
          .run('CREATE (n:User {          \
            firstName : {firstNameParam}, \
            lastName:{lastNameParam},     \
            email:{emailParam},           \
            photo:{photoParam},           \
            id:{idParam}                  \
          }) RETURN n.firstName', {
            firstNameParam: firstName.toLowerCase(), 
            lastNameParam: lastName.toLowerCase(), 
            emailParam:email, 
            photoParam:profileUrl, 
            idParam:uniqueID
          })
          .then(result => {
            res.status(201).send({user});
            session.close();
          })
          .catch(err => {
            session.close();
            console.log("POST: /api/users: Creating new user: *** ERROR ***");
            console.log(err);
          });
      }
    })
    .catch(error => {
      console.log("POST: /api/users: Matching user: *** ERROR ***");
    });
    
  } else { // vanilla login
    let { email, password } = req.body;
    let vanillaPassword = password;
    session.run(
      'MATCH (n:User)\
      WHERE n.email = {emailParam}\
      RETURN n',
      {emailParam: email}
    )
    .then(result => {
      session.close();
      if (result.records.length) { 
        let { id, firstName, lastName, email, password } = result.records[0]._fields[0].properties;
        firstName = firstName || '';
        lastName = lastName || '';
        let hashedPassword = password;
        bcrypt.compare(vanillaPassword, hashedPassword, (err, samePassword) => {
          if (err) {
            console.log('server.js: POST: /api/login: bcrypt.compare');
            throw err;
          }
          if (samePassword) {
            let token = jwt.sign({ email }, process.env.JWT_SECRET, {
              expiresIn: "24h"
            });
            let user = {
              userId: id,
              firstName,
              lastName,
              email,
              authToken: token,
            };
            res.status(201).send({ user });
          } else {
            res.status(400).send({ error: 'Invalid password.' });
          }
        });
      } else {
        console.log('USER NOT FOUND', result);
        res.status(400).send({error: 'User was not found with email:  ' + email});
      }
    })
    .catch(error => {
      session.close();
      console.log('POST /api/login: An error occurred querying user with email', email);
      throw error;
    });
  }

});

// Responds with JSON of all users
app.get('/api/users', function(req, res) {

  // if query paramesters are provided, execute a search
  if (!!Object.keys(req.query).length) {
    var firstName = req.query.firstName; 
    var lastName = req.query.lastName;

    // reject request if the client didn't provide proper query paramters (bad syntax)
    if (!(firstName && lastName)) {
      console.log('bad params');
      res.status(400);
      res.send('Bad request. Use firstName and lastName query parameters only');
    } else {
      // query DB for users whose first name and last name match query parameters
      session.run(
        `MATCH(n:User {firstName: '${firstName.toLowerCase()}', 
        lastName: '${lastName.toLowerCase()}'}) RETURN n`).then(result => {
          res.send(result.records.map(record => {
            return record._fields[0].properties;
          }));
          session.close();
        })
      .catch(err => {
        console.log('ERROR', err);
      });
    }
  } else {
    session.run('MATCH(n:User) RETURN n').then(result => {
      res.send(result.records.map(record => {
        return record._fields[0].properties;
      }));
      session.close();
    })
    .catch(err => {
      console.log('ERROR', err);
    });
  }
});

// Responds with JSON of user model
app.get('/api/users/:userID', function(req, res) {
  var userID = req.params.userID;

  session.run (
      'MATCH (u:User)\
      WHERE u.id = {userID}\
      RETURN u',
      {userID: userID}
    ) //('MATCH (n {id: {userID}}) DETACH DELETE n')
    .then(result => {
      res.status(200).send(result.records.map(record => {
        return record._fields[0].properties;
      }));
      session.close();
    })

    .catch(err => {
      console.log('ERROR', err);
      session.close();
    });
});


// get a list of a user's friends
app.get('/api/users/:userID/friendships', function(req, res) {
  let userID = req.params.userID.toString();

  session.run(`MATCH (n:User {id:'${userID}'})-[r:FRIENDED]->(p:User) RETURN p`)
  .then(result => {
    res.status(200).send(result.records.map(record => {
      return record._fields[0].properties;
    }));
    session.close();
  })
  .catch(error => {
    console.log('***ERROR***');
    console.log(error);
    session.close();
  });
});

// create a new friendship for a given user
app.post('/api/users/:userID/friendships', function(req, res) {
  var friendshipReceiver = req.params.userID.toString();
  var friendshipGiver = req.body.id.toString();

  session.run('MATCH (n:User {id: {friendshipGiverParam}})-[r:FRIENDED]->(m:User {id: {friendshipReceiverParam}}) RETURN n', {
        friendshipGiverParam: friendshipGiver,
        friendshipReceiverParam: friendshipReceiver
      })
  .then(result => {
    if (result.records.length === 0) {
      session.run(
      'MATCH (u:User {id:{friendshipGiverParam}}), (r:User {id:{friendshipReceiverParam}}) CREATE (u)-[:FRIENDED]->(r)', {
        friendshipGiverParam: friendshipGiver,
        friendshipReceiverParam: friendshipReceiver
      }) 
      .then(result => {
        console.log('Friendship created');
        res.status(201).send('Friendship created');
        session.close();
      })
      .catch(err => {
        console.log('ERROR', err);
        session.close();
      });
    } else {
      session.close();
      console.log('the current already friended the other user');
      res.status(400).send('the current already friended the other user');
    }
  });
});

// Creates a new User
app.post('/api/users', function(req, res) {
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  let email = req.body.email || 'No email';
  let photoUrl = req.body.photoUrl || 'No photo';
  var uniqueID;
  if (req.body.fbID ) {
    uniqueID = req.body.fbID;
  } else {
    // let split = email.split('@');
    // uniqueID = split[0];
    uniqueID = uuidV1();
  }

  request({
    uri: `http://localhost:1337/api/users/${uniqueID}`,
    method: 'GET',
  }, (err, response, body) => {
    if (err) {
      console.log('*** ERROR ***');
      console.log(err);
    } else {
      if (!JSON.parse(body)[0] || JSON.parse(body)[0].id !== uniqueID) {
        let userToken = jwt.sign({ email }, process.env.JWT_SECRET, {
          expiresIn: "24h"
        });
        session
          .run('CREATE (n:User {          \
            firstName : {firstNameParam}, \
            lastName:{lastNameParam},     \
            email:{emailParam},           \
            photo:{photoParam},           \
            id:{idParam}                  \
          }) RETURN n.firstName', {
            firstNameParam: firstName.toLowerCase(), 
            lastNameParam: lastName.toLowerCase(), 
            emailParam: email, 
            photoParam: photoUrl, 
            idParam: uniqueID
          })
          .then(result => {
            res.status(201).send(result);
            session.close();
          })
          .catch(err => {
            session.close();
            console.log('*** ERROR ***');
            console.log('ERROR', err);
          });
      } else {
        res.status(400).send('User already exists');
      }
    }
  });
});

// Updates a specified user
app.put('/api/users/:userID/', function(req, res) {
  let userID = req.params.userID;
  let token = req.body.token;

  session
    .run('MATCH (n:User {id: {userIDParam} })\
      SET n.token = {tokenParam}\
      RETURN n', {
        tokenParam: token,
        userIDParam: userID
      })
    .then(result => {
      res.status(200).send(result);
      session.close();
    })
    .catch(err => {
      console.error('PUT: /api/users/:userID: **ERROR**');
      console.log(err);

    });
});

// Responds with JSON of all users
app.get('/api/users', function(req, res) {
  // query DB for all users, send all user models
  session.run('MATCH(n:User) RETURN n').then(result => {
    res.send(result.records.map(record => {
      return record._fields[0].properties;
    }));
    session.close();
  })
  .catch(err => {
    console.log('*** ERROR ***');
    console.log(err);
  });
});

// Responds with JSON of user model
app.get('/api/users/:userID', function(req, res) {
  var userID = req.params.userID;
  session.run (
      'MATCH (u:User)\
      WHERE u.id = {userID}\
      RETURN u',
      {userID: userID}
    ) //('MATCH (n {id: {userID}}) DETACH DELETE n')
    .then(result => {
      res.status(200).send(result.records.map(record => {
        return record._fields[0].properties;
      }));
      session.close();
    })
    .catch(error => {
      console.log(error);
    });
});

// Deletes a specified user
app.delete('/api/users/:userID', function(req, res) {
  let userID = req.params.userID;
  console.log(userID);
  
  session
    .run('MATCH (n:User { id:{userIDParam} })\
          MATCH (a: Pin { userID: {userIDParam} })\
          DETACH DELETE n, a',
    {
      userIDParam: userID
    })
    .then(result => {
      res.status(200).send(result);
      session.close();
    })
    .catch(err => {
      console.log('ERROR', err);
    });
});

/* * * * * * * *
 *             *
 *  PINS API   *
 *             *
 * * * * * * * */

// GET all PRIVATE Pins
app.get('/api/users/:userID/pins/private', function(req, res) {
  let userID = req.params.userID;

  session
    .run('MATCH (m)<-[:FRIENDED]-(n: User {id:{userIDParam} })\
          MATCH (a)<-[:PINNED]-(m)\
          RETURN a',
    { userIDParam: userID })
    .then(result => {
      res.status(200).send({result});
      session.close();
    })
    .catch(err => {
      res.status(404);
      console.log('ERROR', err);
      session.close();
    });
});

// Gets all PUBLIC Pins
app.get('/api/users/:userID/pins/public', function(req, res) {
  let userID = req.params.userID;

  session
    .run('MATCH (a: Pin {privacy:{publicParam} })\
      RETURN a\
      UNION MATCH (m)<-[:FRIENDED]-(n: User {id:{userIDParam} })\
      MATCH (a)<-[:PINNED]-(m)\
      RETURN a',
    { 
      userIDParam: userID,
      publicParam: 'public'
    })    
    .then(result => {
      res.status(200).send({result});
      session.close();
    })
    .catch(err => {
      res.status(404);
      console.log('ERROR', err);
      session.close();
    });
});

// Returns with JSON of all a user's pins
app.get('/api/users/:userID/pins', function(req, res) {
  let userID = req.params.userID;

  session
    .run('MATCH (n:User {id:{userIDParam}})\
          MATCH (pin)<-[:PINNED]-(n)\
          RETURN pin', 
    { userIDParam: userID })
    .then(result => {
      res.status(200).send(result);
      session.close();
    })
    .catch(err => {

      console.log('ERROR', err);
    });
});

// Responds with a single pin
app.get('/api/users/:userID/pins/:pinID', function(req, res) {
  let pinID = req.params.pinID;

  session
    .run('MATCH (a:Pin)\
          WHERE a.id = {pinIDParam}\
          RETURN a', 
    { pinIDParam: pinID })
    .then(result => {
      res.status(200).send(result.records.map(record => {
        return record._fields[0].properties;
      }));
      session.close();

    })
    .catch(err => {
      console.log('ERROR', err);
    });
}); 

app.post('/api/users/:userID/pins', function(req, res) {
  let uniquePinID = uuidV1();
  let location = JSON.stringify(req.body.location);
  let mediaUrl = req.body.mediaUrl;
  let description = req.body.description || 'No description';
  let createdAt = JSON.stringify(new Date());
  let userID = req.params.userID;
  let category = req.body.category;
  let privacy = req.body.privacy;
  let likes = 0;

  session
    .run('MATCH (n:User {id: {userIDParam}})\
        CREATE (a:Pin {\
        id: {pinIDParam},\
        location: {locationParam},\
        mediaUrl: {mediaUrlParam},\
        description: {descriptionParam},\
        createdAt: {createdAtParam},\
        userID: {userIDParam},\
        category: {categoryParam},\
        privacy: {privacyParam},\
        likes: {likesParam}\
      }) MERGE (a)<-[:PINNED]-(n)\
         RETURN a.description', 
    { //:User {id: {userIDParam}}
      pinIDParam: uniquePinID,
      locationParam: location,
      mediaUrlParam: mediaUrl,
      descriptionParam: description,
      createdAtParam: createdAt,
      userIDParam: userID,
      categoryParam: category,
      privacyParam: privacy,
      likesParam: likes 
    })
    .then(result => {
      session
      .run(`MATCH (n:User {id:'${userID}'})<-[r:FRIENDED]-(p:User) RETURN p.token, n.firstName`)
      .then(data => {
        console.log('Successfully posted pin');
        res.status(201).send(data);
        dispatcher.sendPushNotification(data);
        session.close();
      })
    })
    .catch(err => {
      console.log('ERROR', err);
      session.close();
    });
});

app.delete('/api/users/:userID/pins/:pinID', function(req, res) {
  let pinID = req.params.pinID;
  console.log(pinID);

  session
    .run('MATCH (a { id: {pinIDParam} })\
        DETACH DELETE a',
    {
      pinIDParam: pinID
    })
    .then(result => {
      res.status(200).send(result);
      session.close();
    })
    .catch(err => {
      console.log('ERROR', err);
    });
});


// Updates a pin description
app.put('/api/users/:userID/pins/:pinID', function(req, res) {
  let pinID = req.params.pinID;
  let newDesc = req.body.param.description;

  session
    .run('MATCH (a {id: {pinID} })\
      SET a.description = {newDesc}\
      RETURN a'                        
    )
    .then(result => {
      res.status(200).send(result);
      session.close();
    })
    .catch(err => {
      console.log('ERROR', err);
    });
});


app.post('/upload', upload.single('file'), (req, res, next) => {
  res.json(req.file);
});
 

exports.app = app;