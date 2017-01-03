var express = require('express');
var path = require('path');
var neo4j = require('neo4j-driver').v1;
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

// START SERVER; CONNECT DATABASE
var app = express();
var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', '12345'));
var session = driver.session();

app.listen(1337, function() {
  console.log('Listening on port 1337');
});

app.get('/', function(req, res) {
  res.send('hi');
})

app.get('/api/users', function(req, res) {
  // query DB for all users, send all user models

  session.run('MATCH(n:User) RETURN n').then(function(result) {
    res.send(result.records.map(function(record) {
      return record;
    }));
  })
  .catch(function(err) {
    console.log(err);
  });

});

app.get('/api/users/:userID', function(req, res) {
  var userID = req.params.userID;
  res.status(200).send(userID);
});

exports.app = app;