'use strict';

var envVars = __ENV_VARS__;
for (var key in envVars) {
  process.env[key] = envVars[key];
}

var decryptor = require('./serverless-secrets/decryptor');

module.exports.handler = function(event, context, callback) {
  decryptor(function(){
    var originalHandler = __HANDLER_REQUIRE__;
    return originalHandler(event, context, callback);
  });
};
