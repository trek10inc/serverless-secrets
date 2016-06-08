'use strict';

/*
Built specifcally to support decryption from CredStash managed creds.
More details here: https://github.com/fugue/credstash
*/

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient({region: (process.env.CREDSTASH_REGION || 'us-east-1')});
var kms = new AWS.KMS();
var aesjs = require('./aes-js.js');

function _paddedInt(integer) {
  var pad = "0000000000000000000";
  return (pad + integer.toString()).slice(-pad.length);
}

function decrypt(secret, callback){

  var splitVar = secret.split('::');
  var encryptedString = {variable: splitVar[0], version: splitVar[1]};

  var params = {};
  if(encryptedString.version){
    params = {
      TableName : process.env.CREDSTASH_TABLE || 'credential-store',
      Key: {
        name: encryptedString.variable,
        version: _paddedInt(encryptedString.version),
      }
    };

    docClient.get(params, function(err, data) {
      if (err) console.log(err);
      else {
        kms.decrypt({CiphertextBlob: new Buffer(data.Item.key, 'base64')}, function(err, key) {
          if (err) console.log(err, err.stack);
          else{
            var data_key = new Buffer(32);
            var hmac_key = new Buffer(32);
            key.Plaintext.copy(data_key, 0, 0, 32);
            key.Plaintext.copy(hmac_key, 0, 32);

            var value = new Buffer(data.Item.contents, 'base64');
            var aesCtr = new aesjs.ModeOfOperation.ctr(data_key, new aesjs.Counter(1));
            var decryptedBytes = aesCtr.decrypt(value);
            var decryptedText = decryptedBytes.toString('utf-8');

            return callback(null, decryptedText);
          }
        });
      }
    });

  } else {
    params = {
      TableName : process.env.CREDSTASH_TABLE || 'credential-store',
      ScanIndexForward: false,
      Limit: 1,
      KeyConditionExpression: '#N = :hkey',
      ExpressionAttributeValues: {
        ':hkey': encryptedString.variable
      },
      ExpressionAttributeNames: {
        "#N" : "name"
      },
    };

    docClient.query(params, function(err, data) {
      if (err) console.log(err);
      else {
        var cipherText = new Buffer(data.Items[0].key, 'base64');
        kms.decrypt({CiphertextBlob: cipherText }, function(err, key) {
          if (err) console.log(err, err.stack);
          else{
            var data_key = new Buffer(32);
            var hmac_key = new Buffer(32);
            key.Plaintext.copy(data_key, 0, 0, 32);
            key.Plaintext.copy(hmac_key, 0, 32);

            var value = new Buffer(data.Items[0].contents, 'base64');
            var aesCtr = new aesjs.ModeOfOperation.ctr(data_key, new aesjs.Counter(1));
            var decryptedBytes = aesCtr.decrypt(value);
            var decryptedText = decryptedBytes.toString('utf-8');

            return callback(null, decryptedText);
          }
        });
      }
    });
  }
}

module.exports = decrypt;
