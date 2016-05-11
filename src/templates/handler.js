'use strict';

// Such mad hacks
__AES_JS_LIB__

var envVars = __ENV_VARS__;
for (var key in envVars) {
  process.env[key] = envVars[key];
}

// Requires after because we need some env vars for config
var originalHandler = __HANDLER_REQUIRE__;
var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient({region: (process.env.SECRETS_REGION || 'us-east-1')});
var kms = new AWS.KMS();

// Hacky McHackFace
function paddedInt(integer) {
  var pad = "0000000000000000000";
  return (pad + integer.toString()).slice(-pad.length);
}

// Recursively called until all variables are decrypted
function decryptStrings(encryptedStrings, callback){
  getAndDecryptSecret(encryptedStrings.pop(), function(){
    if(encryptedStrings.length <= 0){
      callback();
    } else{
      decryptStrings(encryptedStrings, callback);
    }
  });
}

// I should probably lose any cred I had for this. failboat.gif
function getAndDecryptSecret(encryptedString, callback){
  var params = {};
  if(encryptedString.version){
    console.log("DECRYPTING:", encryptedString.variable, "VERSION:", paddedInt(encryptedString.version));

    params = {
      TableName : process.env.SECRETS_TABLE || 'credential-store',
      Key: {
        name: encryptedString.variable,
        version: paddedInt(encryptedString.version),
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
            var decryptedText = decryptedBytes.toString();

            process.env[encryptedString.key] = decryptedText;
            callback();
          }
        });
      }
    });

  } else {
    console.log("DECRYPTING:", encryptedString.variable, "VERSION: LATEST");

    params = {
      TableName : process.env.SECRETS_TABLE || 'credential-store',
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
      console.log("USING VERSION:", data.Items[0].version);
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
            var decryptedText = decryptedBytes.toString();

            process.env[encryptedString.key] = decryptedText;
            callback();
          }
        });
      }
    });
  }
}

var encryptedStrings = [];

for(var key in envVars){
    var magicString = envVars[key].split('::');
    if(magicString[0] === "secret"){
      var variable = magicString[1] || null;
      var version = magicString[2] || null;

      encryptedStrings.push({key:key, variable: variable, version: version});
    }
}

exports.handler = function(event, context, callback) {
  // If we need to decrypt strings, do it, otherwise don't.
  // Only need to decrypt on first container startup
  if(encryptedStrings.length){
    decryptStrings(encryptedStrings, function(){
      return originalHandler(event, context, callback);
    });
  } else {
    return originalHandler(event, context, callback);
  }
};
