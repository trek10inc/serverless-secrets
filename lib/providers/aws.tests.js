'use strict'

const test = require('ava')
const td = require('testdouble')

let AWS, awsProvider

test.beforeEach('create provider', t => {
  function SSM () {}
  SSM.prototype.getParameters = () => {}
  SSM.prototype.putParameter = () => {}

  AWS = require('aws-sdk')
  AWS.SSM = td.constructor(SSM)
  awsProvider = require('./aws')()
})

test.afterEach.always('cleanup', t => {
  td.reset()
})

test.cb('getSecret: happy path', t => {
  td.when(AWS.SSM.prototype.getParameters(td.matchers.anything()))
    .thenReturn({ promise: () => Promise.resolve({
      Parameters: [
        {
          Name: 'test_parameter',
          Type: 'String',
          Value: 'test_secret'
        }
      ]
    }) })

  awsProvider.getSecret('test_parameter').then(data => {
    t.is(data.test_parameter, 'test_secret')
    t.end()
  })
})

test.cb('getSecret: happy path array', t => {
  td.when(AWS.SSM.prototype.getParameters(td.matchers.anything()))
    .thenReturn({ promise: () => Promise.resolve({
      Parameters: [
        {
          Name: 'test_parameter',
          Type: 'String',
          Value: 'test_secret'
        },
        {
          Name: 'test_parameter2',
          Type: 'String',
          Value: 'test_secret2'
        }
      ]
    }) })

  awsProvider.getSecret(['test_parameter', 'test_parameter2']).then(data => {
    t.is(data.test_parameter, 'test_secret')
    t.is(data.test_parameter2, 'test_secret2')
    t.end()
  })
})

test.cb('getSecret: requests decryption', t => {
  td.when(AWS.SSM.prototype.getParameters(td.matchers.contains({ WithDecryption: true })))
    .thenReturn({ promise: () => Promise.resolve({ Parameters: [] }) })

  awsProvider.getSecret([]).then(() => {
    t.pass()
    t.end()
  })
})

test.cb('getSecret: error bubbles up', t => {
  const error = {}
  td.when(AWS.SSM.prototype.getParameters(td.matchers.anything()))
    .thenReturn({ promise: () => Promise.reject(error) })

  awsProvider.getSecret().catch(() => {
    t.pass()
    t.end()
  })
})

test('setSecret: happy path', t => {
  td.when(AWS.SSM.prototype.putParameter({
    Name: 'name',
    Value: 'value',
    Description: 'description',
    Type: 'String',
    KeyId: 'myKmsKey',
    Overwrite: true
  })).thenReturn({ promise: () => Promise.resolve() })

  awsProvider.setSecret('name', 'value', 'description', false, 'myKmsKey')

  t.pass()
})

test.cb('setSecret: error bubbles up', t => {
  const error = {}
  td.when(AWS.SSM.prototype.putParameter(td.matchers.anything()))
    .thenReturn({ promise: () => Promise.reject(error) })

  awsProvider.setSecret([]).catch(() => {
    t.pass()
    t.end()
  })
})
