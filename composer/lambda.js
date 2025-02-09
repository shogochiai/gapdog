require('dotenv').config()

const AWS = require("aws-sdk")
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_API_KEY,
  secretAccessKey: process.env.S3_API_SECRET,
  region: process.env.S3_REGION
})
const moment = require("moment")
const _ = require("lodash")
const HOURS = 24
const MONTH = 31

exports.handler = function(event, context) {
  // Get 3month data but compase by daily basis
  // This restriction is come from S3 file naming (hour basis naming)
  const range = MONTH*6
  var spans = Array(range).join(".").split("").map((i,j) => moment().utc().subtract(range,'days').add(j,"days").format("YYYYMMDDHH") )
  compose(spans)
  .then(res=>{
    context.done(null, res);
  })
  .catch(err=> context.done(err, err) )
};


function compose(spans){
  return createBucket()
  .then(_=>{
    return Promise.all( spans.map(span=> scan(span) ) )
  })
  .then(upload)
}

function scan(span){
  // const ex = ["trex","polo","cc"]
  // const coins = ["btc","bch","eth","etc","ltc","xrp"]
  // const majortickers = ex.map(name=>{
  //   return coins.map(coin=>{
  //     if(name=='trex') {
  //       if (coin == "bch") coin = "bcc"
  //       coin = coin.toUpperCase()
  //     }
  //     return listObject(null,[],name+"-"+coin+"__"+span)
  //   })
  // })
  const majortickers = []
  const adhoctickers = [
    listObject(null,[],"huobi-zil__"+span),
    listObject(null,[],"hitbtc-xtz__"+span)//,
    // listObject(null,[],"binance-bnt__"+span)
  ]
  return Promise.all(
    _.flatten([
      majortickers,
      adhoctickers
    ])
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


function upload(data){
  return new Promise(function(resolve, reject){
    if(data.length == 0) reject("Data empty")
  
    const csv = toCSV(data)
    var params = {
      Bucket: process.env.S3_BUCKET,
      Key: 'redash-view',
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
