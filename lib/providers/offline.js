'use strict'

module.exports = function (options) {
  function getSecret (parameterNames) {
    // We don't really need this, because serverless-secrets already sets the
    // ENV variables to the right values, but `load()` will complain if we
    // don't return values for all secrets.
    const names = Array.isArray(parameterNames) ? parameterNames : [parameterNames]

    const secrets = {}
    names.forEach((key) => { secrets[key] = key })
    return new Promise((resolve) => resolve(secrets))
  }

  function setSecret (name, value, description = 'Created with Serverless Secrets', isEncrypted = true, keyId) {
    throw new Error('Not implemented')
  }

  function deleteSecret (name) {
    throw new Error('Not implemented')
  }

  function listSecrets () {
    throw new Error('Not implemented')
  }

  return {
    getSecret,
    setSecret,
    deleteSecret,
    listSecrets
  }
}
