require('dotenv').config()

const AWS = require("aws-sdk")
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_API_KEY,
  secretAccessKey: process.env.S3_API_SECRET,
  region: process.env.S3_REGION
})
const moment = require("moment")
const _ = require("lodash")

exports.handler = function(event, context) {
  Promise.all(
    [
       moment().utc().format("YYYYMMDDHH"),
       moment().utc().format("YYYYMMDD"),
       moment().utc().format("YYYYMM")
    ].map(span=>{
      return createBucket()
      .then(_=>{
        return scan(span)
      })
      .then(data=>{
        upload(data, span)
      })
    })
  )
  .then(res=>{
    context.done(null, res);
  })
  .catch(err=> context.done(err, err) )
};

function scan(span){
  const ex = ["trex","polo"]
  const coins = [
    "btc",
    "bch",
    "eth",
    "etc",
    "ltc",
    "xrp"
  ]

  return Promise.all(
    ex.map(name=>{
      return coins.map(coin=>{
        if(name=='trex') {
          if (coin == "bch") coin = "bcc"
          coin = coin.toUpperCase()
        }
        return listObject(null,[],name+"-"+coin+"__"+span)
      })
    })
  )
  .then(list=>{
    return Promise.all( _.flatten(list) )
    .then(names=> Promise.all( _.flatten(names).map(n=> openObject(n) ) ) )
  })
}
function listObject(token, prevKeys = [], prefix){
  return new Promise((resolve, reject) => {
    var opts = {
      Bucket: process.env.S3_LOG_BUCKET
    }
    if(token) opts.ContinuationToken = token
    if(prefix) opts.Prefix = prefix
    s3.listObjectsV2(opts, function(err, data) {
      if (err) reject(err)
      else {
        prevKeys = prevKeys.concat(data.Contents.map(cont=> cont.Key ))
        if(data.IsTruncated){
          return listObject(data.NextContinuationToken, prevKeys, prefix)
          .then(data=>{
            resolve(data)
          })
        } else {
          resolve(prevKeys)
        }
      }
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
        var obj = JSON.parse(str)
        
        // S3 file can be obj/array
        if(typeof obj == "array"){
          obj = obj.map(a=>{
            if (a.name.length < 4) a.name = "cc-"+a.name
            return a
          })
        } else {
          if (obj.name.length < 4) obj.name = "cc-"+obj.name
        }
        resolve(obj)
      }
    })
  })
}


function toCSV(arrayOfObj){
  arrayOfObj = _.flatten(arrayOfObj)
  return require('json2csv')({ data: arrayOfObj, fields: Object.keys(arrayOfObj[0]) })
}


function upload(data, span){
  return new Promise(function(resolve, reject){
    if(data.length == 0) reject("Data empty")

    const csv = toCSV(data)
    console.log(span, csv.length)
    if(span) span = '__'+span
    if(span.length == 10) span = ""
    var params = {
      Bucket: process.env.S3_BUCKET,
      Key: 'redash-view'+span,
      Body: csv,
      ACL: 'public-read'
    }

    s3.upload(params, function(err, data) {
      if(err) reject(err)
      else resolve({ input: csv, output: data })
    })
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
