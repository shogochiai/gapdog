require('dotenv').config()
const calc = require("./src/calc.js").run

const AWS = require("aws-sdk")
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_API_KEY,
  secretAccessKey: process.env.S3_API_SECRET,
  region: process.env.S3_REGION
})
const moment = require("moment")

exports.handler = function(event, context) {
    createBucket()
    .then(calc)
    .then(upload)
    .then(res=>{
      context.done(null, res);
    })
};

function upload(obj){
  return new Promise(function(resolve, reject){
    var params = {
      Bucket: process.env.S3_BUCKET,
      Key: 'idr-jpy-v1__'+moment().format("YYYYMMDDHHmmss"),
      Body: JSON.stringify(obj),
      ACL: 'public-read'
    }
    s3.upload(params, function(err, data) {
      if(err) reject(err)
      else resolve(data)
    });
  })
}

function createBucket(){
  return new Promise(function(resolve, reject){
    var params = {
      Bucket: process.env.S3_BUCKET, 
      CreateBucketConfiguration: {
        LocationConstraint: process.env.S3_REGION
      }
    }
    s3.createBucket(params, function(err, data) {
      if (err && err.code != "BucketAlreadyOwnedByYou" ) reject(err)
      else resolve(data)
    })
  })
}

exports.handler({}, { done: function(err,data){}}) // manual tester