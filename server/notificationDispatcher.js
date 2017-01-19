// import {
//   isExponentPushToken,
//   sendPushNotificationAsync,
// } from 'exponent-server-sdk';

var sdk = require('exponent-server-sdk');
// To check if something is a push token

module.exports = {
  sendPushNotification: (data) => {
    var userFirstName = data.records[0]._fields[1];
    userFirstName = userFirstName.slice(0, 1).toUpperCase() + userFirstName.slice(1);

    data.records.forEach(record => {
      var token = record._fields[0];
      console.log('dispatcher record: ', record);
      if(sdk.isExponentPushToken(token)) {
        sdk.sendPushNotificationAsync({
          exponentPushToken: token, // The push token for the app user you want to send the notification to
          message: token
        });
      }
    })
  }
}