# Serverless Secrets : MAKE SECRETS GREAT AGAIN

*A no fuss way of getting secrets into your Serverless functions, compatible with [Credstash](https://github.com/fugue/credstash)*

# WARNING: STILL SUPER IN DEVELOPMENT, DON'T ACTUALLY USE THIS FOR PRODUCTION (Or look at the source code 😕)

**Problem:** The Serverless project currently offers no good way of managing secrets. There is the `_meta` folder which is ignored from a git repo by default, but what if you are working in a team? You could put it in the repo, but "secrets"  in a git repo is bad practice.

So, what if you could put `_meta` in a secure place and share it around the team? That's what [Serverless meta sync](https://github.com/serverless/serverless-meta-sync) is for... but, then you still have secrets either floating around on developers machines, things could still be out of sync, you have to access control the files to proper machines in your pipeline... it's all not fun.

**Solution:** The `_meta` folder is actually quite good at what it does, and in our humble opinion version controlling it in git is fine, if you had a way to still protect your secrets. So, that's why we are building Severless Secrets. Use [Credstash](https://github.com/fugue/credstash) to put / version / manage your secrets, and use magic strings in your `_meta` folder. That's it.


# Setup

Install / setup credstash. To make things easy on yourself just use defaults (table: credential-store, region: us-east-1)

In the root of your Serverless project...
`npm install serverless-secrets --save`

Configure the IAM policy for the lambda functions that will use encrypted secrets. Don't forget to deploy resources.  
```
# s-resources-cf.json

{
  "Action": [
    "kms:Decrypt"
  ],
  "Effect": "Allow",
  "Resource": "arn:aws:kms:${region}:${awsAccountId}:key/${keyId}"
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

Use the magic string in your `_meta`folder to denote an encrypted secret. Prefixing any variable with `secret::` tells the plugin to fetch and decrypt it. Postfixing a secret with `::{version}` tells it to fetch a version of the given number. (You could probably use alphanumeric too if you wanted.)
```
# _meta/variables/s-variables-common.json
# _meta/variables/s-variables-stage.json
# _meta/variables/s-variables-stage-region.json

{
  ...
  "secretThing": "secret::secret-thing", # Grabs the latest version of a secret
  "secretThing": "secret::secret-thing::1" # Grabs the specific version of a secret
}
```

# Security

> It's pretty good.
> - Abraham Lincoln

# Performance

You will pay a performance penalty of around a second or so on a cold container start for round trips with DynamoDB and KMS. However, after the cold startup, you are clear for takeoff with a nice warmed up cache and basically no time cost.

# Best Practices

> Ask not what your secrets can do for you, ask what you can do for your secrets.
> - JFK, probably
