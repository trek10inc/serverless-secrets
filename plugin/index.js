'use strict'

const fs = require('fs')
const _ = require('lodash')
const constants = require('../lib/constants')

class ServerlessSecrets {
  constructor (serverless, options) {
    this.serverless = serverless
    this.options = options
    this.deployMode = false
    this.config = this.generateConfig()

    // todo figure out what needs to be extracted to another file to support multiprovider CLI
    this.commands = {
      secrets: {
        usage: 'CLI interface for Serverless Secrets. Subcommands: set, get, list-remote, validate.',
        commands: {
          set: {
            lifecycleEvents: ['set'],
            usage: 'Sets a secret value.',
            options: {
              name: {
                usage: '[REQUIRED] name of the secret',
                shortcut: 'n',
                required: true
              },
              text: {
                usage: 'Text to be stored; MUST supply this or --file',
                shortcut: 't'
              },
              file: {
                usage: 'File to be stored; MUST supply this or --text',
                shortcut: 'f'
              },
              region: {
                usage: 'AWS region where secret will be stored; region will fallback to configured (or default) `providerOptions`',
                shortcut: 'r'
              },
              key: {
                usage: 'KMS Key ID or the shortcut name from the keys section of the config',
                shortcut: 'k'
              },
              description: {
                usage: 'Description of the secret',
                shortcut: 'd'
              },
              plaintext: {
                usage: 'Store the secret in plaintext'
              }
            }
          },
          get: {
            lifecycleEvents: ['get'],
            usage: 'Gets a secret value by name.',
            options: {
              name: {
                usage: '[REQUIRED] name of the secret',
                shortcut: 'n',
                required: true
              },
              region: {
                usage: 'AWS region where secret will be stored; if not supplied, region will fallback to configured (or default) `providerOptions`',
                shortcut: 'r'
              }
            }
          },
          'list-remote': {
            lifecycleEvents: ['list-remote'],
            usage: 'Lists all remote secrets.',
            options: {
              region: {
                usage: 'AWS region where secret will be stored; region will fallback to configured (or default) `providerOptions`',
                shortcut: 'r'
              }
            }
          },
          validate: {
            lifecycleEvents: ['validate'],
            usage: 'Validates the secrets used in serverless.yml exist in provider.',
            options: {
              region: {
                usage: 'AWS region where secret will be stored; region will fallback to configured (or default) `providerOptions`',
                shortcut: 'r'
              }
            }
          }
        }
      }
    }

    this.hooks = {
      'secrets:set:set': this.setSecret.bind(this),
      'secrets:get:get': this.getSecret.bind(this),
      'secrets:list-remote:list-remote': this.listRemoteSecretNames.bind(this),
      'secrets:validate:validate': this.validateSecrets.bind(this),
      'before:package:createDeploymentArtifacts': this.packageSecrets.bind(this),
      'after:package:createDeploymentArtifacts': this.cleanupPackageSecrets.bind(this),
      'before:deploy:function:packageFunction': this.packageSecrets.bind(this),
      'after:deploy:function:packageFunction': this.cleanupPackageSecrets.bind(this),
      'before:offline:start': this.packageSecrets.bind(this),
      'before:offline:start:init': this.packageSecrets.bind(this),
      'before:offline:start:end': this.cleanupPackageSecrets.bind(this)
    }
  }

  getStorageProvider () {
    const providerOptions = this.config.providerOptions || {}

    // region flag overrides configuration only when not deploying
    if (!this.deployMode && this.options.region) providerOptions.region = this.options.region

    const providerName = _.get(this.serverless.service, 'provider.name', null)
    switch (providerName) {
      case 'aws':
        return (require('../lib/providers/aws'))(providerOptions)
      default:
        throw new Error(`Provider not supported: ${providerName}`)
    }
  }

  setSecret () {
    let value
    if (this.options.file) {
      value = fs.readFileSync(this.options.file, 'utf8')
    } else if (this.options.text) {
      value = this.options.text
    } else {
      throw new Error('--file or --text is required')
    }

    let defaultKey, customKey
    if (this.config.keys) {
      defaultKey = this.config.keys.default
      if (this.options.key) {
        customKey = this.config.keys[this.options.key]
      }
    }

    const storageProvider = this.getStorageProvider()
    storageProvider
      .setSecret(this.options.name, value, this.options.description, !this.options.plaintext, customKey || this.options.key || defaultKey)
      .then(() => this.serverless.cli.log(`Secret ${this.options.name} stored! Remember to add it to your environmentSecrets section(s) to retrieve it!`))
  }

  getSecret () {
    const storageProvider = this.getStorageProvider()
    storageProvider
      .getSecret(this.options.name)
      .then(data => {
        if (!data[this.options.name]) {
          throw new Error(`Value of secret ${this.options.name} could not be obtained.`)
        }
        console.log(data[this.options.name])
      })
  }

  listRemoteSecretNames () {
    const storageProvider = this.getStorageProvider()
    storageProvider.listSecrets().then(secretKeys => {
      console.log('----------')
      secretKeys
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(key => {
          console.log(`Name: ${key.name}`)
          console.log(`Description: ${key.description}`)
          console.log('----------')
        })
    })
  }

  cleanupPackageSecrets () {
    this.serverless.cli.log(`Cleaning up ${constants.CONFIG_FILE_NAME}`)
    if (fs.existsSync(constants.CONFIG_FILE_NAME)) fs.unlinkSync(constants.CONFIG_FILE_NAME)
  }

  packageSecrets () {
    this.deployMode = true
    this.serverless.cli.log('Serverless Secrets beginning packaging process')
    this.writeConfigFile(this.config)

    if (!_.get(this.serverless.service, 'package.include')) {
      _.set(this.serverless.service, 'package.include', [])
    }
    this.serverless.service.package.include.push(constants.CONFIG_FILE_NAME)

    this.setAdditionalEnvironmentVariables(this.config)
    this.setIamPermissions(this.config)
    return this.validateSecrets(this.config)
  }

  generateConfig () {
    this.serverless.cli.log('Generating Serverless Secrets Config')
    if (!this.serverless.service.provider.name) {
      throw new Error('No provider name configured in serverless.yml')
    }

    // build options object
    const config = Object.assign(
      {
        throwOnMissingSecret: false,
        logOnMissingSecret: true,
        skipValidation: false,
        omitPermissions: false,
        resourceForIamRole: '*'
      },
      _.get(this.serverless.service, 'custom.serverlessSecrets', {}),
      {
        provider: this.serverless.service.provider.name
      }
    )

    // variables
    const functions = this.serverless.service.functions
    config.environments = Object.keys(functions)
      .map(key => functions[key].handler.split('.')[1])
      .reduce((environments, functionName) => {
        if (functions[functionName].environmentSecrets) {
          environments[functionName] = functions[functionName].environmentSecrets
        }
        return environments
      }, {})
    config.environments.$global = this.serverless.service.provider.environmentSecrets || {}

    return config
  }

  writeConfigFile (config) {
    this.serverless.cli.log(`Writing ${constants.CONFIG_FILE_NAME}`)
    fs.writeFileSync(constants.CONFIG_FILE_NAME, JSON.stringify(config))
  }

  setAdditionalEnvironmentVariables (config) {
    // this adds the function name and all of the environmentSecrets to every function just to make them visible
    this.serverless.cli.log('Adding environment variable placeholders for Serverless Secrets')
    const functions = this.serverless.service.functions
    Object.keys(functions).forEach(functionName => {
      if (!functions[functionName].environment) functions[functionName].environment = {}
      Object.assign(functions[functionName].environment, config.environments.$global, config.environments[functionName])
    })
  }

  setIamPermissions (config) {
    let iamRoleStatements = _.get(this.serverless.service, 'provider.iamRoleStatements', null)
    if (!iamRoleStatements) {
      _.set(this.serverless.service, ['provider.iamRoleStatements'], [])
      iamRoleStatements = _.get(this.serverless.service, 'provider.iamRoleStatements')
    }
    if (this.deployMode && !(this.options.omitPermissions || this.config.omitPermissions)) {
      iamRoleStatements.push({
        Effect: 'Allow',
        Action: 'ssm:GetParameters',
        Resource: config.resourceForIamRole || '*' // todo make this enumerate the exact secrets
      })
    }
  }

  validateSecrets (config) {
    if (this.deployMode && (this.options.skipValidation || this.config.skipValidation)) {
      return Promise.resolve()
    }
    this.serverless.cli.log('Validating secrets')
    const provider = this.serverless.service.provider
    const functions = this.serverless.service.functions

    // need to validate that all secrets exist in provider
    const storageProvider = this.getStorageProvider()
    const missingSecretsPromise = storageProvider.listSecrets().then(secrets => {
      const secretKeys = secrets.map(secret => secret.name)
      const missingProviderEnvironmentSecretsGroup = this.findAllEnvironmentSecretsMissingRemotely(provider.environmentSecrets, secretKeys)
      const missingFunctionsEnvironmentSecretsGroups = _.mapValues(functions, func => this.findAllEnvironmentSecretsMissingRemotely(func.environmentSecrets, secretKeys))
      return [this.constructMissingRemoteSecretsErrorMessage(missingProviderEnvironmentSecretsGroup, null)]
        .concat(_.toPairs(missingFunctionsEnvironmentSecretsGroups).map(([funcName, missingSecrets]) => this.constructMissingRemoteSecretsErrorMessage(missingSecrets, funcName)))
        .filter(x => !!x)
        .join('\n')
    })

    // need to check for collisions with regular environment variables
    const providerCollisionGroup = this.findAllEnvironmentSecretsDuplicatedInEnvironment(provider.environmentSecrets, provider.environment)
    const functionsCollisionGroups = _.mapValues(functions, func => this.findAllEnvironmentSecretsDuplicatedInEnvironment(func.environmentSecrets, func.environment))
    const functionsProviderCollisionGroups = _.mapValues(functions, func => this.findAllEnvironmentSecretsDuplicatedInEnvironment(func.environmentSecrets, provider.environment))
    const providerFunctionsCollisionGroups = _.mapValues(functions, func => this.findAllEnvironmentSecretsDuplicatedInEnvironment(provider.environmentSecrets, func.environment))

    const collisionsErrorMessage = [this.constructCollisionsErrorMessage(providerCollisionGroup, null, null)]
      .concat(_.toPairs(providerFunctionsCollisionGroups).map(([funcName, collisionGroups]) => this.constructCollisionsErrorMessage(collisionGroups, null, funcName)))
      .concat(_.toPairs(functionsProviderCollisionGroups).map(([funcName, collisionGroups]) => this.constructCollisionsErrorMessage(collisionGroups, funcName, null)))
      .concat(_.toPairs(functionsCollisionGroups).map(([funcName, collisionGroups]) => this.constructCollisionsErrorMessage(collisionGroups, funcName, funcName)))
      .filter(x => !!x)
      .join('\n')

    return missingSecretsPromise.then(missingSecretsErrorMessage => {
      if (!missingSecretsErrorMessage && !collisionsErrorMessage) {
        this.serverless.cli.log('Secrets validated')
        return
      }
      throw new Error(`\n${missingSecretsErrorMessage}\n${collisionsErrorMessage}`)
    })
  }

  findAllEnvironmentSecretsDuplicatedInEnvironment (environmentSecrets, environment) {
    if (!environmentSecrets || !environment) return []
    return _.flatMap(_.toPairs(environment), ([envKey]) =>
      _.toPairs(environmentSecrets).filter(([secKey]) => secKey === envKey))
  }

  constructCollisionsErrorMessage (collisions, environmentSecretsFunctionName, environmentFunctionName) {
    // null/undefined function name means provider
    if (!collisions.length) return ''
    const envSecretsName = `${environmentSecretsFunctionName ? 'function ' + environmentSecretsFunctionName : 'the provider section'}`
    const envName = `${environmentFunctionName ? 'function ' + environmentFunctionName : 'the provider section'}`
    const collisionsString = collisions.map(([key, value]) => `${key}: ${value}`).join('\n')
    return `The following environmentSecrets entries in ${envSecretsName} conflict with environment entries in ${envName}:\n${collisionsString}`
  }

  findAllEnvironmentSecretsMissingRemotely (environmentSecrets, secretKeys) {
    if (!environmentSecrets) return []
    return _.toPairs(environmentSecrets).filter(([envSecKey, envSecValue]) => !secretKeys.some(secretKey => secretKey === envSecValue))
  }

  constructMissingRemoteSecretsErrorMessage (missingSecrets, environmentSecretsFunctionName) {
    // null/undefined function name means provider
    if (!missingSecrets.length) return ''
    const envSecretsName = `${environmentSecretsFunctionName ? 'function ' + environmentSecretsFunctionName : 'the provider section'}`
    const collisionsString = missingSecrets.map(([key, value]) => `${key}: ${value}`).join('\n')
    return `The following environmentSecrets entries in ${envSecretsName} have not been stored:\n${collisionsString}`
  }
}

module.exports = ServerlessSecrets
