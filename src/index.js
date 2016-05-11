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
        fs         = BbPromise.promisifyAll(require('fs'));

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
      console.log(evt);
      let _this = this;
      _this.project    = S.getProject();
      let func = _this.project.getFunction(evt.options.name);

      const handlerArr = func.handler.split('.'),
          handlerDir = path.dirname(func.handler),
          handlerFile = handlerArr[0].split('/').pop(),
          handlerMethod = handlerArr[1],
          envVarString = JSON.stringify(func.toObjectPopulated({stage: evt.options.stage, region: evt.options.region}).environment);


      // Super hack of building our own templating system
      let handlerTemplate = fs.readFileSync(`${__dirname}/templates/handler.js`, 'utf8');
      let aesJsLib = fs.readFileSync(`${__dirname}/templates/aesjs.lib`, 'utf8');
      handlerTemplate = handlerTemplate.replace(/__AES_JS_LIB__/g, aesJsLib);
      handlerTemplate = handlerTemplate.replace(/__HANDLER_REQUIRE__/g, `require("./${handlerFile}")["${handlerMethod}"]`);
      handlerTemplate = handlerTemplate.replace(/__ENV_VARS__/g, envVarString);

      return fs.writeFileAsync(path.join(evt.data.pathDist, handlerDir, '_serverless_handler.js'), handlerTemplate)
        .then(() => {
          return BbPromise.resolve(evt);
        });
    }
  }

  return ServerlessSecrets;
};
