var _ = require('lodash');

function User(_node) {
  _.extend(this, _node.properties);

  if(this.id) {
    this.id = this.id.toNumber();
  }

  if(this.firstName) {
    this.firstName = this.firstName.toString();
  }

  if(this.lastName) {
    this.lastName = this.lastName.toString();
  }

  if(this.email) {
    this.email = this.email.toString();
  }

  if(this.password) {
    this.password = this.password.toString();
  }

  if(this.fbWebToken) {
    this.fbWebToken = this.fbWebToken.toNumber();
  }

  if(this.userPhotoUrl) {
    this.userPhotoUrl = this.userPhotoUrl.toString();
  }

  if(this.settings) {
    this.settings = this.settings.toString();
  }
}

module.exports = User;