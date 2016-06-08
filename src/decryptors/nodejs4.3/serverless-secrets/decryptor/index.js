'use strict';

var providers = require('../providers');

/*
  The brilliance of this whole plan is that "process.env" is a global variable.
  We override an "encrypted" string for a provider, and we only have to do it
  once for a single container. process.env acts as a "cache" of sorts.
*/

function decryptor(callback){
  var encryptedStrings = [];

  for(var key in process.env){
      var parsedVar = process.env[key].split(/::(.+)/);

      if(typeof providers[parsedVar[0]] !== 'undefined'){
        encryptedStrings.push({key: key, provider:parsedVar[0], rawString: parsedVar[1]});
      }
  }

  // Return right away if no encrypted strings
  if(!encryptedStrings.length){
      return callback();
  }

  // Avoid other dependencies at all cost for smaller footprint
  var decryptedVars = 0;
  encryptedStrings.forEach(function(item){
    console.log("Decrypting", item.key);
    providers[item.provider](item.rawString, function(err, decryptedVar) {

      if(err) console.log(err);
      else{
          process.env[item.key] = decryptedVar;
      }

      decryptedVars++;
      if(decryptedVars === encryptedStrings.length) {
        return callback();
      }

    });
  });
}

module.exports = decryptor;
