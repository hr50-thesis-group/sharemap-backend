var express = require('express');
var path = require('path');
var neo4j = require('neo4j-driver').v1;
var uuidV1 = require('uuid/v1');
var helpers = require('./helpers.js');
var request = require('request');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

// START SERVER; CONNECT DATABASE
var app = express();
var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', '12345'));
var session = driver.session();

app.listen(1337, function() {
  console.log('Listening on port 1337');
});

app.use(jsonParser);
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function(req, res) {
  res.send('hi');
});


/* * * * * * * *
 *             *
 *  USERS API  *
 *             *
 * * * * * * * */


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
      if (!body[0].id) {
        session
          .run('CREATE (n:User {\
            firstName : {firstNameParam},\
            lastName:{lastNameParam},\
            email:{emailParam},\
            photo:{photoParam},\
            id:{idParam}\
          }) RETURN n.firstName', {
            firstNameParam: firstName, 
            lastNameParam: lastName, 
            emailParam: email, 
            photoParam: photoUrl, 
            idParam: uniqueID
          })
          .then(result => {
            console.log('successfully posted: ', result);
            // PARSE THIS RESULT PROPERLY BEFORE SENDING
            res.status(201).send(result);
            session.close();
          })
          .catch(err => {
            session.close();
            console.log('*** ERROR ***');
            console.log(err);
          });
      } else {
        response.status(400).send('User already exists');
      }
    }
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
      console.log(err);
    });
});

/* * * * * * * *
 *             *
 *  PINS API   *
 *             *
 * * * * * * * */

// Returns with JSOn of all a user's pins
app.get('/api/users/:userID/pins', function(req, res) {
  session
    .run('MATCH (a: Pin)\
          RETURN a')
    .then(result => {
      res.status(200).send(result);
      session.close;
    })
    .catch(err => {

      console.log(err);
    });
});

// Responds with a single pin
app.get('/api/users/:userID/pins/:pinID', function(req, res) {
  var pinID = req.params.pinID;
  console.log('test');
  session
    .run('MATCH (a:Pin)\
          WHERE a.id = {pinIDParam}\
          RETURN a', {
            pinIDParam: pinID
          })
    .then(result => {
      res.status(200).send(result.records.map(record => {
        return record._fields[0].properties;
      }));
      session.close();
    })
    .catch(err => {
      console.log(err);
    });
}); 

app.post('/api/users/:userID/pins', function(req, res) {
  let uniquePinID = uuidV1();
  let location = JSON.stringify(req.body.location);
  let mediaUrl = req.body.mediaUrl;
  let description = req.body.description || 'No description';
  let createdAt = JSON.stringify(new Date());
  let userID = req.params.userID;

  session
    .run(' MATCH (n:User {id: {userIDParam}})\
        CREATE (a:Pin {\
        id: {pinIDParam},\
        location: {locationParam},\
        mediaUrl: {mediaUrlParam},\
        description: {descriptionParam},\
        createdAt: {createdAtParam},\
        userID: {userIDParam}\
      }) MERGE (a)<-[:PINNED]-(n)\
         RETURN a.description', 
    { //:User {id: {userIDParam}}
      pinIDParam: uniquePinID,
      locationParam: location,
      mediaUrlParam: mediaUrl,
      descriptionParam: description,
      createdAtParam: createdAt,
      userIDParam: userID
    })
    .then(result => {
      console.log('Successfully posted pin: ', result);
      // !! PASS RESULT TO PIN MODEL HERE !!
      res.status(201).send(result);
      session.close();
    })
    .catch(err => {
      session.close();
      console.log('*** ERROR ***');
      console.log(err);
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
      console.log(err);
    });
});

// Updates a pin description
app.put('/api/users/:userID/pins/:pinID', function(req, res) {
  let pinID = req.params.pinID;
  let newDesc = req.body.description;

  session
    .run('MATCH (a {id: {pinIDParam} })\
      SET a.description = {newDescParam}\
      RETURN a',
    {
      pinIDParam: pinID,
      newDescParam: newDesc
    })
    .then(result => {
      res.status(200).send(result);
      session.close();
    })
    .catch(err => {
      console.log(err);
    });
});


exports.app = app;




