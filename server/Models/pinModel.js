var _ = require('lodash');

function Pin(_node) {
  _.extend(this, _node.properties);

  if(this.id) {
    this.id = this.id.toNumber();
  }

  if(this.location) {
    this.location = this.location.toString();
  }

  if(this.mediaUrl) {
    this.mediaUrl = this.mediaUrl.toString();
  }

  if(this.likes) {
    this.likes = this.likes.toNumber();
  }

  if(this.description) {
    this.description = this.description.toString();
  }

  if(this.user_id) {
    this.user_id = this.user_id.toNumber();
  }

  if(this.createdAt) {
    this.createdAt = this.createdAt.toDateString();
  }
}

module.exports = Pin;