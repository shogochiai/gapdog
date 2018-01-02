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
    .then(bulkUpload)
    .then(res=>{
      context.done(null, res);
    })
};

function bulkUpload(arr){
  const fns = arr.map(obj=> upload(obj) )
  return Promise.all(fns)
}

function upload(obj){
  return new Promise(function(resolve, reject){
    var params = {
      Bucket: process.env.S3_BUCKET,
      Key: 'idr-jpy-'+obj.name+'__'+moment().format("YYYYMMDDHHmmss"),
      Body: JSON.stringify(obj),
      ACL: 'public-read'
    }
    s3.upload(params, function(err, data) {
      if(err) reject(err)
      else resolve({ input: obj, output: data })
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

//exports.handler({}, { done: function(err,data){ console.log(err,data) }}) // manual tester
