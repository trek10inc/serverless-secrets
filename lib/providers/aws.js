'use strict'

const AWS = require('aws-sdk')

const defaultOptions = {
  apiVersion: '2014-11-06',
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
}

module.exports = function (options) {
  const ssm = new AWS.SSM(Object.assign({}, defaultOptions, options))

  function getSecret (parameterNames) {
    const names = Array.isArray(parameterNames) ? parameterNames : [parameterNames]
    const params = {
      Names: names,
      WithDecryption: true
    }

    return ssm.getParameters(params).promise().then(data => {
      return data.Parameters.reduce((obj, x) => {
        obj[x.Name] = x.Value
        return obj
      }, {})
    })
  }

  function setSecret (name, value, description = 'Created with Serverless Secrets', isEncrypted = true, keyId) {
    const params = {
      Name: name,
      Value: value,
      Description: description,
      Type: isEncrypted ? 'SecureString' : 'String',
      Overwrite: true
    }

    if (keyId) params.KeyId = keyId

    return ssm.putParameter(params).promise()
  }

  function deleteSecret (name) {
    return ssm.deleteParameter({
      Name: name
    }).promise()
  }

  function listSecrets () {
    return new Promise((resolve, reject) => {
      const secretKeys = []
      ssm.describeParameters({}).eachPage((err, data, done) => {
        if (err) {
          reject(err)
          return false
        }
        if (!data) {
          resolve(secretKeys)
          return false
        }

        if (data.Parameters && Array.isArray(data.Parameters)) {
          data.Parameters.forEach(parameter => secretKeys.push({
            name: parameter.Name,
            description: parameter.Description
          }))
        }
        done()
        return true
      })
    })
  }

  return {
    getSecret,
    setSecret,
    deleteSecret,
    listSecrets
  }
}
