'use strict';

var AWS = require('aws-sdk');

function decrypt(secret, callback){
  var parsedSecret = secret.split('::');

  var arn = parsedSecret[0];
  var CiphertextBlobBase64 = parsedSecret[1];

  var kms = new AWS.KMS({region: arn.split(':')[3]});

  kms.decrypt({CiphertextBlob: new Buffer(CiphertextBlobBase64, 'base64')}, function(err, response) {
    if (err) console.log(err, err.stack);
    else{
      return callback(null, new Buffer(response.Plaintext).toString('utf-8'));
    }
  });
}

module.exports = decrypt;
