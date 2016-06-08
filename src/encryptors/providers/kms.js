'use strict';

const AWS = require('aws-sdk');
const _ = require('lodash');

function _encryptor(evt, project, callback){
  let config = _.get(project.toObject(), 'custom.secrets');

  // Check if we can get a KMS key
  if(!evt.options.arn && !(config.kms && config.kms.default)){
    return callback(`Please specify a kms key arn with --arn or set a default kms key in project custom configs.
            You can also set shortcuts and use --arn prod to access the prod arn shown below.

            "custom": {
              "secrets": {
                "kms": {
                  "default": "arn:aws:kms:us-east-1:123456789012:alias/MyAliasName",
                  "prod": "arn:aws:kms:us-east-1:123456789012:alias/ProdAliasName"
                }
              }
            }`);
  }

  // Resolve to arn with magic from custom
  if(evt.options.arn && config.kms[evt.options.arn]){
    evt.options.arn = config.kms[evt.options.arn];
  }

  const kmskey = evt.options.arn || config.kms.default;

  const region = kmskey.split(':')[3];
  const kms = new AWS.KMS({region: region});


  var params = {
    KeyId: kmskey,
    Plaintext: evt.options.plaintext,
  };

  kms.encrypt(params, function(err, data) {
    if (err) return callback(err); // an error occurred
    else{
      var params = {
        CiphertextBlob: data.CiphertextBlob,
      };
      callback(null, `kms::${kmskey}::${data.CiphertextBlob.toString('base64')}`);
    }
  });
}


module.exports = _encryptor;
