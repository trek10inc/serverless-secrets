'use strict';

var AWS = require('aws-sdk');
var aesjs = require('./aes-js.js');
var fs = require('fs');

function decrypt(secret, callback){
  var parsedSecret = secret.split('::');

  var arn = parsedSecret[0];
  var CiphertextBlobBase64 = parsedSecret[1];
  var filePath = parsedSecret[2];

  var kms = new AWS.KMS({region: arn.split(':')[3]});

  kms.decrypt({CiphertextBlob: new Buffer(CiphertextBlobBase64, 'base64')}, function(err, response) {
    if (err) console.log(err, err.stack);
    else{
      var aesCtr = new aesjs.ModeOfOperation.ctr(response.Plaintext);
      var encryptedBytes = fs.readFileSync(__dirname+'/../../secrets/kmsfile/'+filePath);

      var decryptedBytes = aesCtr.decrypt(encryptedBytes);

      return callback(null, decryptedBytes.toString());
    }
  });
}

module.exports = decrypt;
