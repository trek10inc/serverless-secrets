# PLUGIN IS DEPRECATED AND UNMAINTAINED. ONLY COMPAITIBLE WITH SLS 0.X.

![serverless_secrets_logo](https://cloud.githubusercontent.com/assets/1689118/15905519/23bf2208-2d83-11e6-96fb-7dc1edd359ee.png)

*A no fuss way of getting secrets into your Serverless functions*

**Problem:** The Serverless project currently offers no good way of managing secrets. There is the `_meta` folder which is ignored from a git repo by default, but what if you are working in a team? You could put it in the repo, but "secrets"  in a git repo is bad practice.

So, what if you could put `_meta` in a secure place and share it around the team? That's what [Serverless meta sync](https://github.com/serverless/serverless-meta-sync) is for... but, then you still have secrets either floating around on developers machines, things could still be out of sync, you have to access control the files to proper machines in your pipeline... it's all not fun.

**Solution:** The `_meta` folder is actually quite good at what it does, and in our humble opinion version controlling it in git is fine, if you had a way to still protect your secrets. So, that's why we are building Serverless Secrets. Use [Credstash](https://github.com/fugue/credstash) to put / version / manage your secrets, and use magic strings in your `_meta` folder. That's it.

# Multi-Provider Support

Serverless Secrets supports multiple providers, and is built to easily allow for more. You can use as many or few providers in each project as you desire.

**KMS** Raw KMS wrapping of short strings, the easiest to get started with.  
**KMS File** Wraps a file with encryption, allowing large blobs to be encrypted.  
**Credstash** A [CredStash](https://github.com/fugue/credstash) compliant decryptor, most flexible and feature rich option, but more setup required.

# Project Setup

In the root of your Serverless project...
`npm install serverless-secrets --save`

Add the plugin in s-project.json...
```
"plugins": [
    "serverless-secrets"
  ]
```  


# KMS & KMS File Providers Setup

### AWS Setup

Configure the IAM policy for the lambda functions that will use encrypted secrets. Don't forget to deploy resources.  
```
# s-resources-cf.json

{
  "Action": [
    "kms:Decrypt"
  ],
  "Effect": "Allow",
  "Resource": "arn:aws:kms:${region}:${awsAccountId}:key/${keyId}"
}
```

### Secrets in `_meta`

Use a magic string in your `_meta` folder to denote an encrypted secret. Prefixing any variable with `kms::` or `kmsfile::` tells the plugin to fetch and decrypt it with the matching provider.

```
# _meta/variables/s-variables-common.json
# _meta/variables/s-variables-stage.json
# _meta/variables/s-variables-stage-region.json

{
  ...
  "secretText": "kms::kmskey::lsjfl39uf3s9faofjas3f9as3ufo23h2hui2h3r9823/23r2382934",
  "secretFile": "kmsfile::kmskey::iuwmkdSLkjef83lsjef9303nskfj393hselkjfJf/soehf33jh::file.txt"
}
```

In both cases, the decryption will be automatically and the full plaintext will
be loaded into the env variable specified in s-function.json. You may still want to do
post processing on it, particularly in the case of the `kmsfile` provider.

### Encryption

**Configuration**
During encrpytion you can specify a key arn with --arn or set a default kms key in project custom configs.
You can also set shortcuts and use --arn prod to access the prod arn shown below.

```
{
  ...
  "custom": {
    "secrets": {
      "kms": {
        "default": "arn:aws:kms:us-east-1:123456789012:alias/MyAliasName",
        "prod": "arn:aws:kms:us-east-1:123456789012:alias/ProdAliasName"
      },
      "kmsfile": {
        "default": "arn:aws:kms:us-east-1:123456789012:alias/MyAliasName",
        "preprod": "arn:aws:kms:us-east-1:123456789012:alias/ProdAliasName"
      }
    }
  }
  ...
}
```

**KMS**  
`serverless secret encrypt --provider kms --plaintext SuperSecretString --arn prod`
`serverless secret encrypt -p kms -t SuperSecretString -a prod`

**KMS File**
`serverless secret encrypt --provider kmsfile --file file.txt --arn preprod`
`serverless secret encrypt -p kmsfile -f file.txt -a preprod`

The KMS File encryptor can work with relative file paths so you can keep all your secrets outside of your repo.  
`serverless secret encrypt -p kmsfile -f ../../secrets-out-of-repo/file.txt -a preprod`

# Credstash Provider Setup
Install / setup [CredStash](https://github.com/fugue/credstash). To make things easy on yourself just use defaults (table: credential-store, region: us-east-1)

Configure the IAM policy for the lambda functions that will use encrypted secrets. Don't forget to deploy resources.  
```
# s-resources-cf.json

{
  "Action": [
    "kms:Decrypt"
  ],
  "Effect": "Allow",
  "Resource": "arn:aws:kms:${region}:${awsAccountId}:$[key|alias]/${keyId}"
},
{
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:Query",
    "dynamodb:Scan"
  ],
  "Effect": "Allow",
  "Resource": "arn:aws:dynamodb:${region}:${awsAccountId}:table/credential-store"
}
```

**NOTE:** You can override default CredStash region and table with CREDSTASH_TABLE and CREDSTASH_REGION environment variables.

### Secrets in `_meta`

Use a magic string in your `_meta` folder to denote an encrypted secret. Prefixing any variable with `credstash::` tells the plugin to fetch and decrypt it with the credstash provider. Postfixing a secret with `::{version}` tells it to fetch a version of the given number. (You could probably use alphanumeric too if you wanted.)
```
# _meta/variables/s-variables-common.json
# _meta/variables/s-variables-stage.json
# _meta/variables/s-variables-stage-region.json

{
  ...
  "secretThing": "credstash::secret-thing", # Grabs the latest version of a secret
  "secretThing": "credstash::secret-thing::1" # Grabs the specific version of a secret
}
```

### Encryption
Use the CredStash CLI provided by credstash to manage your secrets. The CredStash interface has not been re-implemented Serverless Secrets.


# Performance

You will pay a performance penalty of around a second or so on a cold container start for round trips with DynamoDB and KMS. However, after the cold startup, you are clear for takeoff with a nice warmed up cache and basically no time cost.
