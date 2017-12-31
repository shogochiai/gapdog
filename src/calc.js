const coins = [
  "btc",
  "bch",
  "eth",
  "etc",
  "ltc",
  "xrp"
]
const rp = require('request-promise')
const cheerio = require('cheerio')

const rateUri = "http://www.xe.com/currencyconverter/convert/?Amount=1&From=JPY&To=IDR"
rp({ uri: rateUri, transform: body=> cheerio.load(body) })
.then($=>{
  const selector = "#ucc-container > span.uccAmountWrap > span.uccResultAmount";
  const idrjpyrate = parseInt($(selector).text())

  rp({ uri: "https://coincheck.com/api/rate/all" })
  .then((res) => {
    var jpyprice = coins.map((c,i)=> [c, parseInt(JSON.parse(res).jpy[c])] )

    const fns = coins.map(c=> rp({ uri: "https://vip.bitcoin.co.id/api/"+c+"_idr/ticker" }) )
    Promise.all(fns)
    .then((res) => {
      var idrprice = res.map((str,i)=> [coins[i], parseInt(JSON.parse(str).ticker.last)/idrjpyrate, Math.ceil(JSON.parse(str).ticker.vol_idr/1000/1000/idrjpyrate)+"M jpyvol"] )

      function cal(i){
        return [jpyprice[i][0],Math.ceil(jpyprice[i][1]/idrprice[i][1]*1000)/1000, idrprice[i][2]]
      }
      var arr = [cal(0),cal(1),cal(2),cal(3),cal(4),cal(5)]
      var res = JSON.stringify(arr.sort(function(ar1,ar2){ return ar1[1] < ar2[1] ? 1 : -1 }))
      console.log("jpy/idr",res)
    })
  })
})

