var express = require('express');
var path = require('path');
var neo4j = require('neo4j-driver').v1;
var uuidV1 = require('uuid/v1');
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

app.get('/api/users', function(req, res) {
  // query DB for all users, send all user models
  session.run('MATCH(n:User) RETURN n').then(result => {
    res.send(result.records.map(record => {
      return record._fields[0].properties;
    }));
    session.close();
  })
  .catch(function(err) {
    console.log(err);
  });
});

app.post('/api/users', function(req, res) {
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  let email = req.body.email || 'no email';
  let photoUrl = req.body.photoUrl || 'no photo';

  session.run('CREATE (n:User {firstName : {firstNameParam},lastName:{lastNameParam},email:{emailParam}, photo:{photoParam}, id:{idParam}}) RETURN n.firstName', {firstNameParam: firstName, lastNameParam: lastName, emailParam:email, photoParam:photoUrl, idParam:uuidV1()})
    .then(function(result) {
      console.log('successfully posted: ', result.properties);
      // !!! PASS RESULT TO USER MODEL HERE !!! 
      res.status(201).send(result);
      session.close();
    }).catch(function(err) {
      session.close();
      console.log(err);
    })
});

app.get('/api/users/:userID', function(req, res) {
  var userID = req.params.userID;
  session.run (
      'MATCH (u:User) \
      WHERE u.id = {userID} \
      RETURN u',
      {userID: userID}
    )
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

exports.app = app;




