'use strict'
const path = require('path')
const _ = require('lodash')
const constants = require('../lib/constants')

const getConfig = () => require(path.join(process.cwd(), constants.CONFIG_FILE_NAME))

function getStorageProvider (options) {
  switch (options.provider) {
    case 'aws':
      return (require('../lib/providers/aws'))(options.providerOptions || {})
    default:
      throw new Error(`Provider not supported: ${options.provider}`)
  }
}

function load (options) {
  const secrets = getConfig()
  const mergedOptions = Object.assign({}, secrets.options, options)
  const environmentSecrets = Object.assign({}, secrets.environments.$global, secrets.environments[process.env._HANDLER.split('.')[1]])
  const parameterNames = _.uniq(_.values(environmentSecrets))
  const provider = getStorageProvider(mergedOptions)
  return provider.getSecret(parameterNames).then(data => {
    const missingParameters = parameterNames.filter(expected => !_.keys(data).some(received => expected === received))
    Object.assign(process.env, _.mapValues(environmentSecrets, key => data[key]))
    if (missingParameters.length) {
      const message = `Secrets could not be obtained for the following environment variables: ${missingParameters.join(', ')}`
      if (mergedOptions.logOnMissingSecret) console.log(message)
      if (mergedOptions.throwOnMissingSecret) throw new Error(message)
    }
  })
}

function loadByName (envVarName, parameterName, options) {
  const secrets = getConfig()
  const mergedOptions = Object.assign({}, secrets.options, options)
  const provider = getStorageProvider(mergedOptions)
  return provider.getSecret(parameterName).then(data => {
    if (data[parameterName]) {
      process.env[envVarName] = data[parameterName]
    } else {
      const message = `Secret could not be obtained for environment variable: ${envVarName}`
      if (mergedOptions.logOnMissingSecret) console.log(message)
      if (mergedOptions.throwOnMissingSecret) throw new Error(message)
    }
  })
}

module.exports = {
  load,
  loadByName
}
