var express = require('express');
var path = require('path');
var neo4j = require('neo4j-driver').v1;
var uuidV1 = require('uuid/v1');
var helpers = require('./helpers.js');
var request = require('request');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var dispatcher = require('./notificationDispatcher.js');
const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

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
        console.log('*** ERROR ***');
        console.log(err);
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
      console.log('*** ERROR ***');
      console.log(err);
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
    .catch(error => {
      console.log('***ERROR***');
      console.log(error);
      session.close();
    });
});


// get a list of a user's friends
app.get('/api/users/:userID/friendships', function(req, res) {
  let userID = req.params.userID.toString();

  session.run(`MATCH (n:User {id:'${userID}'})<-[r:FRIENDED]-(p:User) RETURN p`)
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
        console.log('friendship created');
        res.status(201).send('friendship created!');
        session.close();
      })
      .catch(error => {
        console.log(error);
        session.close();
      });
    } else {
      session.close();
      console.log('the current already friended the other user');
      res.status(400).send('the current already friended the other user');
    }
  })
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
    method: "GET",
  }, (err, response, body) => {
    if (err) {
      console.log("*** ERROR ***");
      console.log(err);
    } else {
      if (!JSON.parse(body)[0] || JSON.parse(body)[0].id !== uniqueID) {
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
      console.log('updated result...', result);
      res.status(200).send(result);
      session.close();
    })
    .catch(err => {
      console.log(err);
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
  var userID = req.params.userID;

  session
    .run('MATCH (n:User {id:{userIDParam}})\
          MATCH (pin)<-[:PINNED]-(n)  \
          RETURN pin', {userIDParam: userID})
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
  let category = req.body.category;

  session
    .run('MATCH (n:User {id: {userIDParam}})\
        CREATE (a:Pin {\
        id: {pinIDParam},\
        location: {locationParam},\
        mediaUrl: {mediaUrlParam},\
        description: {descriptionParam},\
        createdAt: {createdAtParam},\
        category: {categoryParam},\
        userID: {userIDParam}\
      }) MERGE (a)<-[:PINNED]-(n)\
         RETURN a.description', 
    { //:User {id: {userIDParam}}
      pinIDParam: uniquePinID,
      locationParam: location,
      mediaUrlParam: mediaUrl,
      descriptionParam: description,
      categoryParam: category,
      createdAtParam: createdAt,
      userIDParam: userID
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
// app.put('/api/users/:userID/pins/:pinID', function(req, res) {
//   let pinID = req.params.pinID;
//   let newDesc = req.body.description;

//   session
//     .run('MATCH (a {id: {pinID} })\
//       SET a.description = {newDesc}\
//       RETURN a'                        
//     )
//     .then(result => {
//       res.status(200).send(result);
//       session.close();
//     })
//     .catch(err => {
//       console.log(err);
//     });
// });

app.post('/upload', upload.single('file'), (req, res, next) => {
  res.json(req.file)
});

app.post('/postpin', (req, res, next) => {
  console.log('/postpin post request received');
  res.send('hi');
});

exports.app = app;