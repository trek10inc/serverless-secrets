![serverless_secrets_logo](https://cloud.githubusercontent.com/assets/1689118/15905519/23bf2208-2d83-11e6-96fb-7dc1edd359ee.png)

*An opinionated tool for safely managing and deploying Serverless projects and their secrets*

## Contents
- [Why](#why)
- [Requirements](#requirements)
- [Configuration](#configuration)
- [CLI](#cli)
- [Client](#client)
- [Misc](#misc)

## Why?

**Problem:** The Serverless framework currently offers no way to manage secrets, keys, etc.
You could put them in with your environment variables, but what if you are working in a team?
You could put it in the repo, but "secrets" in a git repo is bad practice.
You could use other tools to simply encrypt with KMS, but you end up storing them in S3 or back in the repo again.
Also, none of these solutions ensures that your secrets have actually been created before deployment...

**Solution:** Serverless Secrets stores your secrets in a place designed for secrets. For AWS, this is
the EC2 Parameter Store, which supports encryption, including custom KMS keys. In addition, Serverless
Secrets offers automated validation of your secrets' presence, making your deployments that much closer
to **bulletproof (TM)**.

## Requirements

### Local requirements

Node.js 6.5 or greater for CLI

### Client requirements

The bundled client is for Node.js only. For other languages, see the following table.

| Language   | Link                                                                                                             |
|------------|------------------------------------------------------------------------------------------------------------------|
| Python 2/3 | [https://github.com/trek10inc/serverless-secrets-python](https://github.com/trek10inc/serverless-secrets-python) |

If you develop a client, please send us a PR to link to your client. All clients should allow for multi-provider support.
Clients need only implement the `getSecret` provider method.

### Framework requirements
Serverless Secrets 3.0.0 and greater is designed for use with Serverless >= 1.12.0. For Serverless 0.x, please
see Serverless Secrets 2.x

### Provider requirements

Currently, Serverless Secrets only supports AWS. However, it has been designed with support for
other providers in mind down the road. We welcome PRs for this too.

#### AWS

The bundled client requires Node 6.10 (or greater in the future). Feel free to develop and contribute your
own clients for other languages.

### Offline support

Serverless Secrets should work with [Serverless Offline](https://github.com/dherault/serverless-offline),
but not in a fully offline (no Internet connection) setting. You will still need access to your provider
to load the secrets.

## Configuration

### Adding Serverless Secrets to your project

In the root of your Serverless project:

`npm install serverless-secrets --save-dev` or `yarn add serverless-secrets --dev`

Add the plugin to your `serverless.yml`:

```
plugins:
  - serverless-secrets
```

### environmentSecrets

With a standard Serverless project, you can use the `environment` property to add environment variables
to individual functions as well as to all of your functions via the `provider` section. We augment this
concept by adding an `environmentSecrets` section to the provider and any function. Just like
`environment`, the properties under the `environmentSecrets` property become environment variables,
with the keys becoming the environment variable names. However, the values of the properties under
`environmentSecrets` are the names of the secrets in the secure store (e.g. Parameter Store for AWS).
Once you have set your secrets with the CLI (see below), just make sure they are all listed correctly in
`environmentSecrets`. You should not duplicate any `environmentSecrets` keys in `environment`. This is
checked during the validation step. Here's an example:

```
provider:
  environment:
    API_USER: asdf@asdf.com
  environmentSecrets:
    API_KEY: '/my-project/${opt:stage}/API_KEY'
```

If this project included a Node function, after loading the secrets, `process.env.API_KEY` would contain
the stored secret value.

### custom.serverlessSecrets section

There are a number of options avaliable to customize how Serverless Secrets operates. These should be
set under `custom.serverlessSecrets` in your `serverless.yml`. Here's an example showing that the
secrets are stored in us-west-2 and listing 2 KMS keys for use with the CLI:

```
custom:
  serverlessSecrets:
    providerOptions:
      region: us-west-2
    keys:
      default: "alias/myDefaultKey"
      anotherKey: "alias/myOtherKey"
```

#### options

The following options apply to both the custom section *and the client methods*. The custom section
values will be deployed to your functions and become the default values for the client methods.

- `throwOnMissingSecret` - boolean: If set to true, an error will be thrown if any secret
is unable to be retrieved. Default value: `false`.
- `logOnMissingSecret` - boolean: If set to true, an message will be logged if any secret
is unable to be retrieved. Default value: `true`.
- `providerOptions` - object: The options object to be passed to the CLI/client provider. This will
*overwrite* the default provider options.
  - Default AWS provider options:
  ```
  {
    apiVersion: '2014-11-06',
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
  }
  ```

The following options apply only to the custom section as they are only used in deploy/package CLI
operations:

- `skipValidation` - boolean: If set to true, validation of the existence of your secrets in
your provider's secret store will not be performed during deployment/packaging operations.
Default value: `false`.
- `omitPermissions` - boolean: If set to true, permissions will not automatically be added
to your functions' IAM roles to allow them access to secrets. In that case, you will need to add
those permissions manually. Default value: `false`.
  - AWS: This grants permission to the `ssm:GetParameters` action.
- `resourceForIamRole` - string | [string]: This is the string or array of strings that become the
value of `Resource` in the IAM role that grants the `ssm:GetParameters` action. This does nothing
if `omitPermissions` is true. Default value: '*'.

The following options apply only to the custom section as they are only used in Serverless Secrets
CLI operations:

- `keys` - object: This is an object that can be used create shortcuts for your KMS keys. You can
specify a `default` key, along with other named keys. Any operation that takes a key id will
search the shortcuts first. If no key id is provided, the `default` key will be used, if set.
If no key id is provided and no `default` exists, the provider default will be used.

## CLI

### serverless secrets set [parameters]

Store secrets in your provider's secret store

#### Parameters

`--name / -n`: REQUIRED; name of the secret

`--text / -t`: Text to be stored; MUST supply this or `--file`

`--file / -f`: File to be stored; MUST supply this or `--text`

`--region / -r`: OPTIONAL; if not supplied, region will fallback to configured (or default) `providerOptions`

`--key / -k`: OPTIONAL; KMS Key ID or the shortcut name from the `keys` section of the config

`--description / -d`: OPTIONAL; Description of the secret

`--plaintext`: OPTIONAL; Store the secret in plaintext

#### Usage samples

*Simple encrypted storage*

`serverless secrets set --name my-secret --text my-secret`

`serverless secrets set -n my-secret -t my-secret`

*Encrypted storage with description, custom KMS key, and region*

`serverless secrets set --name my-secret --text my-secret --key "alias/aws/ssm" --description "My secret" --region us-west-2`

`serverless secrets set -n my-secret -t my-secret -k alias/aws/ssm -d "My secret" -r us-west-2`

*Plaintext storage*

`serverless secrets set --name not-so-secret --plaintext --text my-secret --description  "Not-so-secret"`

*File storage (pay attention to your provider's limits here!)*

`serverless secrets set --name my-secret-file --file file.txt`

`serverless secrets set -n my-secret-file -f file.txt`

### serverless secrets get [name]

Retrieve decrypted values of your secrets from the provider's secret store

#### Parameters

`--name / -n`: REQUIRED; name of the secret

`--region / -r`: OPTIONAL; if not supplied, region will fallback to configured (or default) `providerOptions`

#### Usage samples

`serverless secrets get --name my-secret --region us-west-2`

### serverless secrets list-remote

List all of the secrets (name and description only) stored in a given region

#### Parameters

`--region / -r`: OPTIONAL; if not supplied, region will fallback to configured (or default) `providerOptions`

#### Usage samples

`serverless secrets list-remote --region us-west-2`

### serverless secrets validate

2 step validation process:
1. No duplicates between `environment` and `environmentSecrets` sections: This ensures that there are no conflicts
within the provider section or any function and between the provider and each function.
2. All secrets exist in the provider's secret store: all values listed in all `environmentSecrets` sections are
checked against the supplied or configured region.

If any issues are found, an error is thrown with a detailed log of all detected issues.

#### Parameters

`--region / -r`: OPTIONAL; if not supplied, region will fallback to configured (or default) `providerOptions`

#### Usage samples

`serverless secrets validate --region us-west-2`

### other serverless commands

These notes cover commands like `serverless deploy` and `serverless package`

#### Flags

You can provide `--skipValidation` and/or `--omitPermissions` to activate these options, even if you have not
turned them on in the `custom.serverlessSecrets` section of your `serverless.yml`. See options documentation for details.

The `--region / -r` flag for things like `serverless deploy` is completely ignored by the Serverless Secrets plugin during
packaging/deployment. You should have this configured in your `custom.serverlessSecrets` section of your `serverless.yml`.

#### Processing during packaging

Serverless Secrets performs a good amount of its magic during any operation that include packaging of
your project. Let's cover those steps:
1. All configuration data is written to a JSON file called `.serverless-secrets.json`.
Note: while it does not contain any secret data, you probably still ought to add this to your `.gitignore`
(or other VCS exclusion config).
2. `.serverless-secrets.json` is added to your package
3. All of your `environmentSecrets` are converted intact to regular environment variables. This is *strictly*
for documentation purposes. We find it helpful to be able to see in the provider's console that the secret
variables exist, even if the values are only the lookup keys. If you remove or change these values, it will
have no effect.
4. Permissions to access the secret store are injected into roles.
5. Secret validation is performed. For details on this process, see the `serverless secrets validate` CLI command.
It is worth noting that failure to validate still throws an error which makes this useful as part of any good CI
process.

## Client

The client can automatically load all of your secrets into environment variables, or you can choose to load
them individually. Decryption is done automatically, meaning that the full plaintext will be loaded into the
environment variable. You may still want to do post processing on it, particularly in the case of the files.

Remember: do not `require` modules that need the environment variables loaded by the client before the
environment variables have actually been loaded.

### `client.load(options)`

*Parameters:*
- `options` - object: The options object as described in the `custom.serverlessSecrets` section above.
It is merged over the top of the `custom.serverlessSecrets` configuration.

*Returns:* Promise

*Side effects:* Uses generated configuration to determine the environment variables to be filled
and the keys to request from the secret store to fill those variables. After the secret store
responds, the environment variables are then set to the corresponding returned secrets.

*Sample code:*
```
// Given: a secret named '/my-project/dev/api-key' is stored in SSM with value 'mySecret'
// Given: an environmentSecret named 'API_KEY' exists with a value of '/my-project/dev/api-key'

const secretsPromise = require('serverless-secrets/client').load();

module.exports.handler = function (event, context, callback) {
  secretsPromise.then(() => {
    // process.env.API_KEY now contains 'mySecret'

    // logic goes here
  }).catch(err => {
    // handle errors here
  });
};
```

### `client.loadByName(environmentVariableName, parameterName, options)`

*Parameters:*
- `environmentVariableName` - string: name of the key to be added to `process.env` that
will contain the retrieved secret value
- `parameterName` - string: name of the secret to be retrieved from the secret store
- `options` - object: The options object as described in the `custom.serverlessSecrets` section above.
It is merged over the top of the `custom.serverlessSecrets` configuration.

*Returns:* Promise

*Side effects:* Retrieves `parameterName` from the secret store and loads it
into `process.env[environmentVariableName]`

*Sample code:*
```
// Given: a secret named '/my-project/dev/api-key' is stored in SSM with value 'mySecret'

const secretsClient = require('serverless-secrets/client');
const ssPromise = secretsClient.loadByName('API_KEY', '/my-project/dev/api-key');

module.exports.handler = function (event, context, callback) {
  ssPromise.then(() => {
    // process.env.API_KEY now contains 'mySecret'

    // logic goes here
  }).catch(err => {
    // handle errors here
  });
};
```

## Misc

### AWS IAM

If you disable automatic permission injection, remember to grant your lambda functions
access to get parameters from SSM
in your `serverless.yml`. Example:

```
provider:
  iamRoleStatements:
    - Effect: "Allow"
      Action: "ssm:GetParameters"
      Resource: "arn:aws:ssm:${region}:${awsAccountId}:parameter/*"
```

## Future feature ideas

- Clone secrets from one region to another
