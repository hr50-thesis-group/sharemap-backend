var neo4j = require('neo4j-driver').v1;
var request = require('request');
var expet = require('chai').expect;

describe('Neo4j Graph Database', function() {

  beforeEach(function(done) {
    var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', '12345'));
    var session = driver.session();
  });

  afterEach(function() {
    session.close();
    driver.close();
  });

  it('Should return all users from the DB'. function(done) {
    request({
      method: 'GET',
      uri: 'http://127.0.0.1:1337',
      json: {
        firstname: 'Tim',
        lastname: 'Chin',
        email:
      }
    })
  })
});

