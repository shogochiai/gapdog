const rp = require('request-promise')
const cheerio = require('cheerio')

const coins = [
  "btc",
  "bch",
  "eth",
  "etc",
  "ltc",
  "xrp"
]

function run(){
  return scrape()
    .then(cc)
    .then(btcid)
    .then(compare)
}



function scrape(){
  const rateUri = "http://www.xe.com/currencyconverter/convert/?Amount=1&From=JPY&To=IDR"
  return rp({ uri: rateUri, transform: body=> cheerio.load(body) })
}

function cc($){
  const selector = "#ucc-container > span.uccAmountWrap > span.uccResultAmount";
  const idrjpyrate = parseInt($(selector).text())
  return rp({ uri: "https://coincheck.com/api/rate/all" }).then(res=>{
    return {
      idrjpyrate: idrjpyrate,
      cc: res
    }
  })
}

function btcid(res){
  const cc = res.cc
  const idrjpyrate = res.idrjpyrate
  var jpyprice = coins.map((c,i)=> [c, parseInt(JSON.parse(cc).jpy[c])] )

  const fns = coins.map(c=> rp({ uri: "https://vip.bitcoin.co.id/api/"+c+"_idr/ticker" }) )
  return Promise.all(fns).then(res=>{
    return {
      btcid: res,
      jpyprice: jpyprice,
      idrjpyrate: idrjpyrate
    }
  })
}

function compare(res){
  return new Promise((resolve, reject) => {
    const btcid = res.btcid
    const jpyprice = res.jpyprice
    const idrjpyrate = res.idrjpyrate
    var idrprice = btcid.map((str,i)=> [coins[i], parseInt(JSON.parse(str).ticker.last)/idrjpyrate, Math.ceil(JSON.parse(str).ticker.vol_idr/1000/1000/idrjpyrate)+"M yen"] )

    function cal(i){
      return {
        name: jpyprice[i][0],
        diff: "+"+norm(jpyprice[i][1], idrprice[i][1])+"%",
        vol: idrprice[i][2]
      }
    }
    function norm(jpp,idp){
      return Math.ceil((1-Math.ceil(jpp/idp*1000)/1000)*1000)/10
    }
    var arr = [cal(0),cal(1),cal(2),cal(3),cal(4),cal(5)]

    var obj = {
      timestamp: new Date(),
      rates: arr
    }
    
    resolve(obj)
  })
}

module.exports.run = run
