'use strict';

const AWS = require('aws-sdk');
const _ = require('lodash');
const aesjs = require('aes-js');
const fs = require('fs');
const path = require('path');
const mkpath = require('mkpath');

function _encryptor(evt, project, callback){
  let config = _.get(project.toObject(), 'custom.secrets');

  // Check if we can get a KMS key
  if(!evt.options.arn && !(config.kmsfile && config.kmsfile.default)){
    return callback(`Please specify a kms key arn with --arn or set a default kms key in project custom configs.
            You can also set shortcuts and use --arn prod to access the prod arn shown below.

            "custom": {
              "secrets": {
                "kmsfile": {
                  "default": "arn:aws:kms:us-east-1:123456789012:alias/MyAliasName",
                  "prod": "arn:aws:kms:us-east-1:123456789012:alias/ProdAliasName"
                }
              }
            }`);
  }

  // Resolve to arn with magic from custom
  if(evt.options.arn && config.kmsfile[evt.options.arn]){
    evt.options.arn = config.kmsfile[evt.options.arn];
  }

  if(!evt.options.file){
    return callback('You must specify a --file option when using the kmfile encryptor');
  }

  let plaintext;

  try {
    plaintext = fs.readFileSync(path.join(process.cwd(), evt.options.file));
  } catch(e) {
    return callback(e);
  }


  const kmskey = evt.options.arn || config.kmsfile.default;

  const region = kmskey.split(':')[3];
  const kms = new AWS.KMS({region: region});

  var params = {
    KeyId: kmskey,
    KeySpec: 'AES_256'
  };

  kms.generateDataKey(params, function(err, data){
    if (err) return callback(err); // an error occurred
    else{

      mkpath.sync(path.join(project.getRootPath(), '_meta', 'secrets', 'kmsfile'));

      let aesCtr = new aesjs.ModeOfOperation.ctr(data.Plaintext);
      let encryptedBytes = aesCtr.encrypt(plaintext);

      fs.writeFileAsync(path.join(project.getRootPath(), '_meta', 'secrets', 'kmsfile', path.basename(evt.options.file)), encryptedBytes);
      return callback(null, `kmsfile::${kmskey}::${data.CiphertextBlob.toString('base64')}::${path.basename(evt.options.file)}`);
    }
  });
}


module.exports = _encryptor;
