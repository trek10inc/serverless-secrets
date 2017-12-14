'use strict'

const test = require('ava')
const td = require('testdouble')
const _ = require('lodash')
const path = require('path')
const constants = require('../lib/constants')

let client, provider, awsModule, secrets, processEnvClone

const defaultSecrets = {
  options: {
    provider: 'aws',
    throwOnMissingSecret: true,
    logOnMissingSecret: false,
    skipValidation: false
  },
  environments: {
    $global: {},
    testFunction: {}
  }
}

process.env._HANDLER = 'asdf.asdf'
processEnvClone = _.cloneDeep(process.env)
secrets = _.cloneDeep(defaultSecrets)

test.beforeEach('create client', t => {
  awsModule = td.replace('../lib/providers/aws', td.function())
  provider = td.object(['getSecret', 'setSecret'])
  td.when(awsModule(td.matchers.anything())).thenReturn(provider)

  td.replace(
    path.join(process.cwd(), constants.CONFIG_FILE_NAME),
    secrets
  )

  client = require('./index')
})

test.afterEach.always('cleanup', t => {
  td.reset()
  // tests that touch process.env or secrets are run serially
  // this step restores process.env and secrets between tests
  process.env = _.cloneDeep(processEnvClone)
  secrets = _.cloneDeep(defaultSecrets)
})

test.serial.cb('load: happy path', t => {
  secrets.environments.$global.test_variable = 'test_parameter'

  const promise = Promise.resolve({test_parameter: 'test_secret'})
  td.when(provider.getSecret(['test_parameter'])).thenReturn(promise)

  client.load().then(() => {
    t.is(process.env.test_variable, 'test_secret')
    t.end()
  })
})

test.serial.cb('load: no env vars to retrieve', t => {
  td.when(provider.getSecret(td.matchers.anything())).thenReturn(Promise.resolve({}))

  client.load().then(() => {
    t.pass()
    t.end()
  })
})

test.cb('load: provider errors bubble up', t => {
  const error = {}
  td.when(provider.getSecret(td.matchers.anything())).thenReturn(Promise.reject(error))

  client.load().catch(err => {
    t.is(err, error)
    t.end()
  })
})

test.serial.cb('load: missing parameter errors', t => {
  secrets.environments.$global.test_variable = 'test_parameter'

  td.when(provider.getSecret(['test_parameter'])).thenReturn(Promise.resolve({}))

  client.load(secrets.options).catch(err => {
    t.truthy(err.message.length)
    t.end()
  })
})

test('load: invalid provider throws', t => {
  t.throws(() => client.load({ provider: 'TrumpCloud'}))
})

test.serial.cb('loadByName: happy path', t => {
  const promise = Promise.resolve({test_parameter: 'test_secret'})
  td.when(provider.getSecret('test_parameter')).thenReturn(promise)

  client.loadByName('test_variable', 'test_parameter').then(() => {
    t.is(process.env.test_variable, 'test_secret')
    t.end()
  })
})

test.cb('loadByName: provider errors bubble up', t => {
  const error = {}
  td.when(provider.getSecret(td.matchers.anything())).thenReturn(Promise.reject(error))

  client.loadByName('test_variable', 'test_parameter').catch(err => {
    t.is(err, error)
    t.end()
  })
})

test.serial.cb('loadByName: missing parameter errors', t => {
  secrets.environments.$global.test_variable = 'test_parameter'

  td.when(provider.getSecret('test_parameter')).thenReturn(Promise.resolve({}))

  client.loadByName('test_variable', 'test_parameter', secrets.options).catch(err => {
    t.truthy(err.message.length)
    t.end()
  })
})
