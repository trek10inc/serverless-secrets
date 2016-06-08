'use strict';

var decryptor = require('./serverless-secrets/decryptor');

var envVars = __ENV_VARS__;
for (var key in envVars) {
  process.env[key] = envVars[key];
}

var originalHandler = __HANDLER_REQUIRE__;

module.exports.handler = function(event, context, callback) {
  decryptor(function(){
    return originalHandler(event, context, callback);
  });
};
