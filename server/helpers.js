var neo4j = require('neo4j-driver').v1;
var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', '12345'));
var session = driver.session();

function userDoesExist(userID) {
  session.run (
      'MATCH (u:User) \
      WHERE u.id = {userID} \
      RETURN u',
      {userID: userID}
    ) 
    .then(result => {
      session.close();
      if (result) {
        return true;
      } else {
        return false;
      }
    })
    .catch(error => {
      session.close();
      console.log(error);
      return false
    });
}

// function hashEmail(email) {
//   var split = email.split('')
//   for (var i = 0; i < email.length; i++) {
//     let code = email.charCodeAt(i);
    
//     split[i] = String.fromCharCode(code+1);
//   }
//   return split.join('');
// }


exports.userDoesExist = userDoesExist;