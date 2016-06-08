var AWS = require('aws-sdk');
var kms = new AWS.KMS({region: 'us-east-1'});

CiphertextBlobBase64 = "CiDZOVE8Sg9RUIiajI+8gPaN5ChCUVn2EYTKRtpcDQ+s0RKXAQEBAgB42TlRPEoPUVCImoyPvID2jeQoQlFZ9hGEykbaXA0PrNEAAABuMGwGCSqGSIb3DQEHBqBfMF0CAQAwWAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAz9fryxCa9nQ5Q+JbQCARCAKwAFcGxl3ec9+yzjZN8GRTbB0AGlhnadyf97DIzK+xSF7syOtjoUVKJpH5o="

kms.decrypt({CiphertextBlob: new Buffer(CiphertextBlobBase64, 'base64')}, function(err, response) {
    if (err) console.log(err, err.stack);
    else{
      console.log(new Buffer(response.Plaintext).toString('utf-8'));
    }
  });
