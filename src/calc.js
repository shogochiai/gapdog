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
  return Promise.all([
    rate("JPY","IDR"),
    rate("USD","JPY"),
    cc(),
    btcid(),
    mama(),
    bitfinex()
  ])
  .then(compare)
  .catch(err=> console.error(err) )
}



function rate(from,to){
  const rateUri = "http://www.xe.com/currencyconverter/convert/?Amount=1&From="+from+"&To="+to
  return rp({ uri: rateUri, transform: body=> cheerio.load(body) })
  .then($=>{
    const selector = "#ucc-container > span.uccAmountWrap > span.uccResultAmount";
    const rate = parseFloat($(selector).text())
    return rate
  })
}

function cc(){
  return rp({ uri: "https://coincheck.com/api/rate/all" })
}

function mama(){
  function fetch(uri, selectors){
    return rp({ uri: uri, transform: body=> cheerio.load(body) }).then($=>{
      var scrapedData = selectors.map(s=> parseFloat($(s).text()) )
      const normalizedMamaTokens = [99.95,499.95,999.95,4999.95].map((base,i)=> base/scrapedData[i] )
      const average = arr => arr.reduce( ( p, c ) => p + c, 0 )/ arr.length
      const mamarate = average(normalizedMamaTokens)
      return mamarate
    })
  }
  return Promise.all([
    fetch('https://www.coinmama.com/bitcoins' ,[
      "#content > div > div:nth-child(5) > div > div:nth-child(1) > div > h3 > span",
      "#content > div > div:nth-child(6) > div > div:nth-child(1) > div > h3 > span",
      "#content > div > div:nth-child(7) > div > div:nth-child(1) > div > h3 > span",
      "#content > div > div:nth-child(8) > div > div:nth-child(1) > div > h3 > span",
    ]),
    fetch('https://www.coinmama.com/ether' ,[
      "#pricing-box-eth > div:nth-child(1) > div > div:nth-child(1) > div > h3 > span",
      "#pricing-box-eth > div:nth-child(2) > div > div:nth-child(1) > div > h3 > span",
      "#pricing-box-eth > div:nth-child(3) > div > div:nth-child(1) > div > h3 > span",
      "#pricing-box-eth > div:nth-child(4) > div > div:nth-child(1) > div > h3 > span",
    ])
  ])
}
function bitfinex(){
  return Promise.all([
    rp({uri: 'https://api.bitfinex.com/v1/pubticker/btcusd'}),
    rp({uri: 'https://api.bitfinex.com/v1/pubticker/ethusd'})
  ])
}


function btcid(){
  const fns = coins.map(c=> rp({ uri: "https://vip.bitcoin.co.id/api/"+c+"_idr/ticker" }) )
  return Promise.all(fns)
}

function compare(allres){
  return new Promise((resolve, reject) => {
    const idrjpyrate = allres[0]
    const jpyusdrate = allres[1]
    const ccdata = allres[2]
    const btciddata = allres[3]
    const mamadata = allres[4]
    const finexbtcdata = JSON.parse(allres[5][0])
    const finexethdata = JSON.parse(allres[5][1])

    const jpyprice = coins.map((c,i)=> [c, parseFloat(JSON.parse(ccdata).jpy[c])] )
    const idrprice = btciddata.map((str,i)=> [coins[i], parseFloat(JSON.parse(str).ticker.last)/idrjpyrate, parseInt(parseFloat(JSON.parse(str).ticker.vol_idr)/idrjpyrate)] )
    const usdprice = [["btc", mamadata[0]*jpyusdrate, 0],["eth", mamadata[1]*jpyusdrate, 0]]
    const usdprice2 = [["btc", parseFloat(finexbtcdata.last_price)*jpyusdrate, parseInt(finexbtcdata.volume*jpyusdrate)],["eth", parseFloat(finexethdata.last_price)*jpyusdrate, parseInt(finexethdata.volume*jpyusdrate)]]

    function cal(i, type){
      
      var obj = {}
      
      if(type=="usd"){
        switch(i){
          case 0:
            obj = {
              name: "mamabtc",
              diff: norm(idrprice[0][1],usdprice[0][1]),
              vol: usdprice[0][2],
              timestamp: new Date()
            }
            break
          case 1:
            obj = {
              name: "mamaeth",
              diff: norm(idrprice[2][1],usdprice[1][1]),
              vol: usdprice[1][2],
              timestamp: new Date()
            }
            break
          case 2:
            obj = {
              name: "finexbtc",
              diff: norm(idrprice[0][1],usdprice2[0][1]),
              vol: usdprice2[0][2],
              timestamp: new Date()
            }
            break
          case 3:
            obj = {
              name: "finexeth",
              diff: norm(idrprice[2][1],usdprice2[1][1]),
              vol: usdprice2[1][2],
              timestamp: new Date()
            }
            break
          default:
        }
      } else { //jpy
        obj = {
          name: jpyprice[i][0],
          diff: norm(idrprice[i][1],jpyprice[i][1]),
          vol: idrprice[i][2],
          timestamp: new Date()
        }
      }
      
      return obj
    }
    function norm(higher,lower){
      return parseFloat( ((higher/lower-1)*100).toPrecision(4) )
    }
    var arr = [cal(0,"jpy"),cal(1,"jpy"),cal(2,"jpy"),cal(3,"jpy"),cal(4,"jpy"),cal(5,"jpy"),cal(0,"usd"),cal(1,"usd"),cal(2,"usd"),cal(3,"usd")]

    resolve(arr)
  })
}

module.exports.run = run
