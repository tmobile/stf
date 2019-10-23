module.exports.command = 'device-ios'

module.exports.builder = function(yargs) {
  return yargs
    .strict()
    .option('serial', {
      describe: 'UUID of IOS device'
    , type: 'string'
    , demand: true
    })
    .option('connect-push', {
      alias: 'p'
    , describe: 'ZeroMQ PULL endpoint to connect to.'
    , array: true
    , demand: true
    })
    .option('connect-sub', {
      alias: 's'
    , describe: 'ZeroMQ PUB endpoint to connect to.'
    , array: true
    , demand: true
    })
    .option('public-ip', {
      describe: 'The IP or hostname to use in URLs.'
    , type: 'string'
    , demand: true
    })
    .option('wda-port', {
      describe: 'The WDA Server port in mac.'
    , type: 'string'
    , default: '8100'
    })
    .option('vid-port', {
      describe: 'The video streaming port'
    , type: 'string'
    , default: '8000'
    })
}

module.exports.handler = function(argv) {
  return require('../../units/device-ios')({
    serial: argv.serial
  , publicIp: argv.publicIp
  , wdaPort: argv.wdaPort
  , vidPort: argv.vidPort
  , endpoints: {
      sub: argv.connectSub
    , push: argv.connectPush
    }
  })
}
