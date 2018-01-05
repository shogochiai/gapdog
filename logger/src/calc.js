const rp = require('request-promise').defaults({maxRedirects:100})
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
    bitfinex(),
    bittrex(),
    rate("USDT","JPY"),
    poloniex()
  ])
  .then(compare)
  .catch(err=> console.error(err) )
}



function rate(from,to){
  var rateUri = ''
  var selector = ''
  if(from == "usdt" || to == "usdt" ){
    rateUri = "https://currencio.co/"+from+"/"+to+"/"
    selector = "body > section > div > div.col-md-7.site-content > div.convert-component > div.convert-form > div.clearfix.convert-info > div.col-xs-5.col-sm-3.text-right.convert-rate > span"
  } else {
    rateUri = "http://www.xe.com/currencyconverter/convert/?Amount=1&From="+from+"&To="+to
    selector = "#ucc-container > span.uccAmountWrap > span.uccResultAmount";
  }
  return rp({ uri: rateUri, transform: body=> cheerio.load(body) })
  .then($=>{
    const rate = parseFloat($(selector).text())
    return rate
  })
}

function cc(){
  return rp({ uri: "https://coincheck.com/api/rate/all" })
}

function mama(){
  function fetch(uri, selectors){
    // return Promise.resolve(0)
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
function bittrex(){
  return Promise.all([
    rp({uri:"https://bittrex.com/api/v1.1/public/getmarketsummary?market=usdt-btc"}),
    rp({uri:"https://bittrex.com/api/v1.1/public/getmarketsummary?market=usdt-bcc"}),
    rp({uri:"https://bittrex.com/api/v1.1/public/getmarketsummary?market=usdt-eth"}),
    rp({uri:"https://bittrex.com/api/v1.1/public/getmarketsummary?market=usdt-etc"}),
    rp({uri:"https://bittrex.com/api/v1.1/public/getmarketsummary?market=usdt-ltc"}),
    rp({uri:"https://bittrex.com/api/v1.1/public/getmarketsummary?market=usdt-xrp"})
  ])
}
function poloniex(){
  return rp({uri:'https://poloniex.com/public?command=returnTicker'})
}


function btcid(){
  const fns = coins.map(c=> rp({ uri: "https://vip.bitcoin.co.id/api/"+c+"_idr/ticker" }) )
  return Promise.all(fns)
}

function compare(allres){
  return new Promise((resolve, reject) => {
    const idrjpyrate = allres[0]
    const usdjpyrate = allres[1]
    const ccdata = allres[2]
    const btciddata = allres[3]
    const mamadata = allres[4]
    const finexbtcdata = JSON.parse(allres[5][0])
    const finexethdata = JSON.parse(allres[5][1])
    const bittrexdata = allres[6].map(str=> JSON.parse(str).result[0] )
    const usdtjpyrate = allres[7]
    const polodata = JSON.parse(allres[8])

    var jpyprice = {}
    coins.map((c,i) => {
      jpyprice[c] = { price:parseFloat(JSON.parse(ccdata).jpy[c]), vol:0 }
    })
    var idrprice = {}
    btciddata.map((str,i) => {
      var data = { price:parseFloat(JSON.parse(str).ticker.last)/idrjpyrate, vol:parseInt(parseFloat(JSON.parse(str).ticker.vol_idr)/idrjpyrate)}
      idrprice[coins[i]] = data
    })
    const usdprice = {
      btc: {
        price: mamadata[0]*usdjpyrate,
        vol: 0
      },
      eth: {
        price: mamadata[1]*usdjpyrate,
        vol: 0
      }
    }
    const usdprice2 = {
      btc: {
        price: parseFloat(finexbtcdata.last_price)*usdjpyrate,
        vol: parseInt(finexbtcdata.volume*usdjpyrate)
      },
      eth: {
        price: parseFloat(finexethdata.last_price)*usdjpyrate,
        vol: parseInt(finexethdata.volume*usdjpyrate)
      }
    }
    var bittrexprice = {}
    bittrexdata.map(obj=>{
      const name = obj.MarketName.replace("USDT-","").toLowerCase()
      const jpybittrexprice = parseFloat(obj.Last*usdtjpyrate)
      const jpyvol = parseInt(obj.Volume*usdtjpyrate)
      bittrexprice[name] = { price:jpybittrexprice, vol:jpyvol}
    })
    var poloprice = {}
    Object.keys(polodata).filter(ticker=>{
      return coins.includes(ticker.replace("USDT_","").toLowerCase())
    }).map(ticker=>{
      var obj = polodata[ticker]
      const name = ticker.replace("USDT_","").toLowerCase()
      const jpypoloprice = parseFloat(obj.last*usdtjpyrate)
      const jpyvol = parseInt(obj.quoteVolume*usdtjpyrate)
      poloprice[name] = { price:jpypoloprice, vol:jpyvol}
    })


    function cal(ticker, type){
      
      var obj = {}
      
      if(type=="mama"){
        obj = {
          name: "mama"+ticker,
          // diff: 0,
          diff: norm(idrprice[ticker].price,usdprice[ticker].price),
          vol: usdprice[ticker].vol,
          timestamp: new Date()
        }
      } else if (type=="finex") { //jpy
        obj = {
          name: type+ticker,
          diff: norm(idrprice[ticker].price,usdprice2[ticker].price),
          vol: usdprice2[ticker].vol,
          timestamp: new Date()
        }
      } else if (type=="cc") { //jpy
        obj = {
          name: type+"-"+ticker,
          diff: norm(idrprice[ticker].price,jpyprice[ticker].price),
          vol: idrprice[ticker].vol,
          timestamp: new Date()
        }
      } else if (type=='bittrex') {
        if(ticker=='bcc') {
          idrprice.bcc = idrprice.bch
        }
        obj = {
          name: "trex-"+ticker.toUpperCase(),
          diff: norm(idrprice[ticker].price,bittrexprice[ticker].price),
          vol: bittrexprice[ticker].vol,
          timestamp: new Date()
        }
      } else if (type=='polo') {
        obj = {
          name: "polo-"+ticker,
          diff: norm(idrprice[ticker].price,poloprice[ticker].price),
          vol: poloprice[ticker].vol,
          timestamp: new Date()
        }
      }
      
      return obj
    }
    function norm(higher,lower){
      return parseFloat( ((higher/lower-1)*100).toPrecision(4) )
    }
    var arr = [
      cal("btc","cc"),
      cal("bch","cc"),
      cal("eth","cc"),
      cal("etc","cc"),
      cal("ltc","cc"),
      cal("xrp","cc"),
      cal("btc","mama"),
      cal("eth","mama"),
      cal("btc","finex"),
      cal("eth","finex"),
      cal("btc","bittrex"),
      cal("bcc","bittrex"),
      cal("eth","bittrex"),
      cal("etc","bittrex"),
      cal("ltc","bittrex"),
      cal("xrp","bittrex"),
      cal("btc","polo"),
      cal("bch","polo"),
      cal("eth","polo"),
      cal("etc","polo"),
      cal("ltc","polo"),
      cal("xrp","polo")
    ]

    resolve(arr)
  })
}

module.exports.run = run