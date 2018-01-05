require('dotenv').config()

const AWS = require("aws-sdk")
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_API_KEY,
  secretAccessKey: process.env.S3_API_SECRET,
  region: process.env.S3_REGION
})
const moment = require("moment")

exports.handler = function(event, context) {
    createBucket()
    .then(fetch)
    .then(toCSV)
    .then(uploadCSV)
    .then(res=>{
      context.done(null, res);
    })
};

function fetch(){
  return listObject()
  .then(list=>{
    return Promise.all(
      list.map(name=> openObject(name) )
    )
  })
}
function listObject(){
  return new Promise((resolve, reject) => {
    s3.listObjects({
      Bucket: process.env.S3_LOG_BUCKET
    }, function(err, data) {
      if (err) reject(err)
      else resolve(data.Contents.map(cont=> cont.Key ))
    })
  })
}
function openObject(name){
  return new Promise((resolve, reject) => {
    s3.getObject({
      Bucket: process.env.S3_LOG_BUCKET,
      Key: name
    }, function(err, data) {
      if (err) reject(err)
      else {
        var str = data.Body.toString('ascii')
        resolve(JSON.parse(str))
      }
    })
  })
}


function toCSV(arrayOfObj){
  return new Promise((resolve, reject) => {
    resolve(require('json2csv')({ data: arrayOfObj, fields: Object.keys(arrayOfObj[0]) }))
  })
}


function uploadCSV(csv){
  return new Promise(function(resolve, reject){
    var params = {
      Bucket: process.env.S3_BUCKET,
      Key: 'redash-view',
      Body: csv,
      ACL: 'public-read'
    }
    s3.upload(params, function(err, data) {
      if(err) reject(err)
      else resolve({ input: csv, output: data })
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

// exports.handler({}, { done: function(err,data){ console.log(err,data) }}) // manual tester
