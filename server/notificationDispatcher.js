// import {
//   isExponentPushToken,
//   sendPushNotificationAsync,
// } from 'exponent-server-sdk';

var sdk = require('exponent-server-sdk');
// To check if something is a push token
let isPushToken = sdk.isExponentPushToken('ExponentPushToken[0Bit_ACLp7elbDOW5Z9Ms4]');

// To send a push notification
(function () {
  sdk.sendPushNotificationAsync({
    exponentPushToken: 'ExponentPushToken[0Bit_ACLp7elbDOW5Z9Ms4]', // The push token for the app user you want to send the notification to
    message: "WHAT IT DO?!",
    data: {withSome: 'XD'},
  });
})();