var wire = require('../../../wire')
var ProductType = require("./TypeToModel")

var execFileSync = require('child_process').execFileSync;
var images = require('images')
var simctl = require('./simctl')
var fs =  require('fs')

function iDeviceInfo( serial, options ) {
    var args = ["-u",serial]
    if( options ) args.concat( options )
    var lines = execFileSync( "ideviceinfo", args, {} ).toString().split("\n")
    var hash = {};
    for( var lineNum in lines ) {
        var parts = lines[ lineNum ].split(": ")
        hash[ parts[0] ] = parts[1]
    }
    return hash
}
var DeviceInfo = {
    getBatteryInfo: function(serial,type='device'){
        var result = {
          serial:serial
          ,status:"charging"
          ,health:"good"
          ,source:"usb"
          ,level:level
          ,scale:100
          ,temp:0
          ,voltage:0
        }
        if( type == 'emulator' ) return result
        
        var batInfo = iDeviceInfo( serial, [ "-q", "com.apple.mobile.battery" ] )
        result.level = parseInt( batInfo["BatteryCurrentCapacity"], 10 )
        result.status = batInfo["BatteryIsCharging"]=="true" ? "charging" : "discharging"
        
        return result
    }
    
    ,getDisplay:function(serial,type='device'){
        if( type == 'emulator' ) return simctl.GetDisplay( serial )
        
        var filename = "/tmp/" + serial + ".png"
        execFileSync( "idevicescreenshot", [ "-u", serial, filename ], {} )
        var img = images( filename )
        var result = { width: img.width(), height: img.height() }
        
        fs.unlinkSync( filename )
        
        return result
    }
    
    ,getDeviceInfo: function(serial,type='device'){
        var result = {
            serial:        serial
            ,platform:     "iOS"
            ,manufacturer: "Apple"
            ,operator:     ""
            ,sdk:          ""
            ,phone: {
                imei:         ""
                ,imsi:        ""
                ,phoneNumber: ""
                ,iccid:       ""
                ,network:     ""
            }
            ,product:         "Apple"
            ,cpuPlatform:     ""
            ,openGLESVersion: ""
        }
        
        if( type == 'emulator' ) {
            var info = simctl.GetSimInfo(serial)
            result.version = info.sdk
            result.model   = info.name
            result.product = "Apple Simulator"
            result.display = simctl.GetDisplay(serial)
            result.abi     = "arm64"
            return result
        }
        
        // type == "device"
        var devInfo = iDeviceInfo( serial )
        result.abi     = devInfo[ "CPUArchitecture" ]
        result.version = devInfo[ "ProductVersion"  ]
        result.model   = ProductType.toModel( devInfo[ "ProductType" ] )
        result.display = DeviceInfo.getDisplay( serial, "device" )
        return result
    }
}

module.exports = DeviceInfo;

