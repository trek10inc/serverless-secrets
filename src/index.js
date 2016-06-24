'use strict';

/**
 * Serverless Package Plugin
 */

module.exports = function(S) {

  const path       = require('path'),
        SUtils     = S.utils,
        SError     = require(S.getServerlessPath('Error')),
        SCli       = require(S.getServerlessPath('utils/cli')),
        _          = require('lodash'),
        BbPromise  = require('bluebird'),
        fs         = BbPromise.promisifyAll(require('fs')),
        ncp        = require('ncp').ncp,
        encryptors = require('./encryptors');

  class ServerlessSecrets extends S.classes.Plugin {

    /**
     * Constructor
     */

    constructor() {
      super();
    }

    /**
     * Define your plugins name
     */

    static getName() {
      return 'com.trek10.' + ServerlessSecrets;
    }

    /**
     * Register Actions
     */

     // Todo, port credstash to nodejs?
    registerActions() {

      S.addAction(this._encrypt.bind(this), {
        handler:       'encrypt',
        description:   'Encrypt a secret from the CLI',
        context:       'secret',
        contextAction: 'encrypt',
        options:       [
          {
            option:      'provider',
            shortcut:    'p',
            description: 'Provider to use for encryption (kms, kmsfile)'
          },
          {
            option:      'plaintext',
            shortcut:    't',
            description: 'Plaintext string to encrypt'
          },
          {
            option:      'file',
            shortcut:    'f',
            description: 'Plaintext file to encrypt'
          },
          {
            option:      'region',
            shortcut:    'r',
            description: 'AWS Region (kms, kmsfile)'
          },
          {
            option:      'arn',
            shortcut:    'a',
            description: 'ARN or name from Custom config for the key to use ex: "prod", or "arn:aws:kms:us-east-1:123456789012:alias/MyKey"'
          },
          {
            option:      'quiet',
            shortcut:    'q',
            description: 'Don\'t display usage information when encrypting'
          }
        ],
        parameters: []
      });

      return BbPromise.resolve();
    }

    /**
     * Register Hooks
     */

    registerHooks() {
      S.addHook(this._addSecretsHandling.bind(this), {
        action: 'codePackageLambda',
        event: 'post'
      });

      return BbPromise.resolve();
    }


    _addSecretsHandling(evt){
      let _this = this;
      _this.project    = S.getProject();
      let func = _this.project.getFunction(evt.options.name);

      const handlerArr = func.handler.split('.'),
          handlerDir = path.dirname(func.handler),
          handlerFile = handlerArr[0].split('/').pop(),
          handlerMethod = handlerArr[1],
          envVarString = JSON.stringify(func.toObjectPopulated({stage: evt.options.stage, region: evt.options.region}).environment);


      //  // Super hack of building our own templating system
       let handlerTemplate = fs.readFileSync(path.join(__dirname, 'decryptors', func.getRuntime().getName(), '_serverless_handler.js'), 'utf8');
       handlerTemplate = handlerTemplate.replace(/__HANDLER_REQUIRE__/g, `require("./${handlerFile}")["${handlerMethod}"]`);
       handlerTemplate = handlerTemplate.replace(/__ENV_VARS__/g, envVarString);

       return fs.writeFileAsync(path.join(evt.data.pathDist, handlerDir, '_serverless_handler.js'), handlerTemplate)
        .then(() => {
          return new BbPromise(function(resolve, reject){
            ncp(path.join(__dirname, 'decryptors', func.getRuntime().getName(), 'serverless-secrets'), path.join(evt.data.pathDist, handlerDir, 'serverless-secrets'), function (err) {
              ncp(path.join(_this.project.getRootPath(), '_meta', 'secrets'), path.join(evt.data.pathDist, handlerDir, 'secrets'), function (err) {
                resolve(evt);
              });
            });
          });
        });
    }

    _encrypt(evt){
      let _this = this;
      _this.project    = S.getProject();

      // Check if provider exist
      if (typeof encryptors[evt.options.provider] != 'function') {
        return SCli.log(`Uh oh, the ${evt.options.provider} provider doesn't exist. Try kms or kmsfile.`);
      }

      encryptors[evt.options.provider](evt, _this.project, function(err, response){
        let message = response;
        if(err){
          return SCli.log(err);
        }

        if(!evt.options.quiet){
          message =
          `Your secret has been encypted.
            Please copy paste the string below into your _meta folder, and include it
            in the relevant s-function environment configurations.

            ${response}
          `;
        }

        return SCli.log(message);
      });
    }

  }

  return ServerlessSecrets;
};
