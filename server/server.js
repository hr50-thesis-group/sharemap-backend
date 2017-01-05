var express = require('express');
var path = require('path');
var neo4j = require('neo4j-driver').v1;
var uuidV1 = require('uuid/v1');
var helpers = require('./helpers.js');
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
})

// Users API
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
    console.log("*** ERROR ***");
    console.log(err);
  });
});

// Responds with JSON of user model
app.get('/api/users/:userID', function(req, res) {
  var userID = req.params.userID;
  session.run (
      'MATCH (u:User) \
      WHERE u.id = {userID} \
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
      session.close();
      console.log(error);
    });
});

// Creates a new User
app.post('/api/users', function(req, res) {
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  let email = req.body.email || 'No email';
  let photoUrl = req.body.photoUrl || 'No photo';
  let uniqueID = req.body.fbID !== null ? req.body.fbID : uuidV1();
  // check if user is already in DB
  if (helpers.userDoesExist(uniqueID)) {
    res.status(400).send('User already exists');
  } else {
    session
      .run('CREATE (n:User {          \
        firstName : {firstNameParam}, \
        lastName:{lastNameParam},     \
        email:{emailParam},           \
        photo:{photoParam},           \
        id:{idParam}                  \
      }) RETURN n.firstName', {
        firstNameParam: firstName, 
        lastNameParam: lastName, 
        emailParam:email, 
        photoParam:photoUrl, 
        idParam:uniqueID
      })
      .then(result => {
        console.log('successfully posted: ', result);
        // PARSE THIS RESULT PROPERLY BEFORE SENDING
        res.status(201).send(result);
        session.close();
      })
      .catch(err => {
        session.close();
        console.log("*** ERROR ***");
        console.log(err);
      })
  }
});

// Deletes a specified user
app.delete('/api/users/:userID',function(req, res) {

});

// Pins API

app.get('/api/users/:userID/pins', function(req, res) {

});

app.post('/api/users/:userID/pins', function(req, res) {
  let location = req.body.location;
  let mediaUrl = req.body.mediaUrl;
  let description = req.body.description || 'No description';
  let createdAt = req.body.createdAt;

  session
    .run('CREATE (a:Pin {                \
        location: {locationParam},       \
        mediaUrl: {mediaUrlParam},       \
        description: {descriptionParam}, \
        createdAt: {createdAtParam}      \
      }) RETURN a' , {
        locationParam: location,
        mediaUrlParam: mediaUrl,
        descriptionParam: description,
        createdAtParam: createdAt
      }
    )
    .then(function(result) {
      console.log('Successfully posted pin: ', result);
      // !! PASS RESULT TO PIN MDOELHERE !!
      res.status(201).send(result);
      session.close();
    })
    .catch(function(err) {
      console.log(err);
    })
});

app.get('/api/users/:userID/:pinID', function(req, res) {

});



exports.app = app;




