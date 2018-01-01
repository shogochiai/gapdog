exports.handler = function(event, context) {
    require("./src/calc.js").run().then(res=>{
      context.done(null, res);
    })
};

