// import {
//   isExponentPushToken,
//   sendPushNotificationAsync,
// } from 'exponent-server-sdk';

var sdk = require('exponent-server-sdk');
// To check if something is a push token

// To send a push notification
// (function () {
//   sdk.sendPushNotificationAsync({
//     exponentPushToken: 'ExponentPushToken[0Bit_ACLp7elbDOW5Z9Ms4]', // The push token for the app user you want to send the notification to
//     message: "WHAT IT DO?!",
//     data: {withSome: 'XD'},
//   });
// })();

module.exports = {
  sendPushNotification: (data) => {
    var userFirstName = data.records[0]._fields[1].slice(0, 1).toUpperCase() + userFirstName.slice(1);

    data.records.forEach(record => {
      var token = record._fields[0];
      if(sdk.isExponentPushToken(token)) {
        sdk.sendPushNotificationAsync({
          exponentPushToken: token, // The push token for the app user you want to send the notification to
          message: userFirstName + ' just posted a pin near you!',
          data: userFirstName + ' just posted a pin near you!'
        });
      }
    })
  }
}