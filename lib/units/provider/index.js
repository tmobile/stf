var adb = require('adbkit')
var Promise = require('bluebird')
var _ = require('lodash')
var EventEmitter = require('eventemitter3')

var logger = require('../../util/logger')
var wire = require('../../wire')
var wireutil = require('../../wire/util')
var wirerouter = require('../../wire/router')
var procutil = require('../../util/procutil')
var lifecycle = require('../../util/lifecycle')
var srv = require('../../util/srv')
var zmqutil = require('../../util/zmqutil')
var zmq = require('zmq')
var crypto = require('crypto')

module.exports = function(options) {
  var log = logger.createLogger('provider')
  var workers = {}
  var solo = wireutil.makePrivateChannel()
  var lists = {
    all: []
  , ready: []
  , waiting: []
  }
  var totalsTimer

  // To make sure that we always bind the same type of service to the same
  // port, we must ensure that we allocate ports in fixed groups.
  var ports = options.ports.slice(
    0
  , options.ports.length - options.ports.length % 4
  )

  // Information about total devices
  var delayedTotals = (function() {
    function totals() {
      if (lists.waiting.length) {
        log.info(
          'Providing %d of %d device(s); waiting for "%s"'
        , lists.ready.length
        , lists.all.length
        , lists.waiting.join('", "')
        )

        delayedTotals()
      }
      else if (lists.ready.length < lists.all.length) {
        log.info(
          'Providing all %d of %d device(s); ignoring "%s"'
        , lists.ready.length
        , lists.all.length
        , _.difference(lists.all, lists.ready).join('", "')
        )
      }
      else {
        log.info(
          'Providing all %d device(s)'
        , lists.all.length
        )
      }
    }

    return function() {
      clearTimeout(totalsTimer)
      totalsTimer = setTimeout(totals, 10000)
    }
  })()

  // Output
  var push = zmqutil.socket('push')
  Promise.map(options.endpoints.push, function(endpoint) {
    return srv.resolve(endpoint).then(function(records) {
      return srv.attempt(records, function(record) {
        log.info('Sending output to "%s"', record.url)
        push.connect(record.url)
        return Promise.resolve(true)
      })
    })
  })
  .catch(function(err) {
    log.fatal('Unable to connect to push endpoint', err)
    lifecycle.fatal()
  })

  // Input
  var sub = zmqutil.socket('sub')
  Promise.map(options.endpoints.sub, function(endpoint) {
    return srv.resolve(endpoint).then(function(records) {
      return srv.attempt(records, function(record) {
        log.info('Receiving input from "%s"', record.url)
        sub.connect(record.url)
        return Promise.resolve(true)
      })
    })
  })
  .catch(function(err) {
    log.fatal('Unable to connect to sub endpoint', err)
    lifecycle.fatal()
  })

  // Establish always-on channels
  ;[solo].forEach(function(channel) {
    log.info('Subscribing to permanent channel "%s"', channel)
    sub.subscribe(channel)
  })

  var connected = {};
  
  // Track IOS devices; notifications received over ZeroMQ from coordinator
  var sock2 = zmq.socket('sub');
  sock2.connect('tcp://127.0.0.1:7294');
  sock2.subscribe('devEvent');
  sock2.on( 'message', function( topic, msg ) {
    var str = msg.toString();
    if( str == "dummy" ) return;
    var ob = JSON.parse( str );

    if( ob.Type == 'connect' && !connected[ ob.UUID ] ) {
      connected[ ob.UUID ] = 1
      log.info('Tracking iOS device')
      log.info('  UUID:   ', ob.UUID )
      log.info('  Name:   ', ob.Name )
      log.info('  WDAPort:', ob.WDAPort )
      log.info('  VidPort:', ob.VidPort )

      push.send([
        wireutil.global
        , wireutil.envelope(
          new wire.DeviceIntroductionMessage( 
            ob.UUID, wireutil.toDeviceStatus('device'), new wire.ProviderMessage(solo, options.name)
          )
        )
      ])
      var hash = crypto.createHash('sha1')
      hash.update(ob.UUID)
      
      function makeChannelId(serial) {
        var hash = crypto.createHash('sha1')
        hash.update(serial)
        return hash.digest('base64')
      }
      
      var chanId = makeChannelId( ob.UUID );
      var channel = chanId
      sub.subscribe(chanId)
      
      log.info('iOS channel: ', channel)
    }
    else if( ob.Type == 'heartbeat' ) {
      log.info('IOS Heartbeat: ', ob.UUID )
      push.send ([
        wireutil.global
        , wireutil.envelope(new wire.DeviceHeartbeatMessage(ob.UUID))
      ])
    }
    else if( ob.Type == 'disconnect' ) {
      delete connected[ ob.UUID ]
      log.info('---------------- IOS Device disconnect')
      log.info('  UUID: ', ob.UUID )
      push.send([
        wireutil.global
        , wireutil.envelope(new wire.DeviceAbsentMessage(ob.UUID))
      ])
    }
  } );
  
  sub.on(
    'message', 
    wirerouter().on(
      wire.DeviceRegisteredMessage,
      function(channel, message) {
        log.info("sub messsage:", message.serial, 'register' )
      }
    ).handler()
  );
}
