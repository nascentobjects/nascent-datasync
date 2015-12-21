var util = require('util');
var EventEmitter = require('events').EventEmitter;
var crypto = require('crypto');

// on: 'event'
// on: 'eventname'
// on: 'datachanged'
// on: 'connected'
// on: 'disconnected'

var NascentDataSyncCommandCharacteristicUUID = 'c50dc35b-9a1b-40c2-bc97-96ee7254579c';


function NascentDataSyncEventCharacteristic(dataSync) {
    bleno.Characteristic.call(this, {
        uuid: NascentDataSyncCommandCharacteristicUUID,
        properties: ['write', 'indicate'],
        value: null
    });

    this.dataSync = dataSync;
}
util.inherits(NascentDataSyncEventCharacteristic, bleno.Characteristic);

NascentDataSyncEventCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
    console.log('Received Command: ' + data);
    var cmd = JSON.parse('' + data);
    this.dataSync.emit(cmd.c, cmd.a);

    callback(this.RESULT_SUCCESS);
};

function NascentDataSync(options) {
    if (!('id' in options)) {
        throw 'An id must be given';
    }

    this.serviceUUID = '686c3dbf2f844eb88e620c12fc534f7b';
    //this.serviceUUID = 'n' + crypto.createHash('md5').update(options.id).digest('hex');

    EventEmitter.call(this);

    this.data = {};

    var self = this;

    bleno.on('stateChange', function(state) {
        if (state === 'poweredOn') {
            bleno.startAdvertising('nascent', [self.serviceUUID]);
        } else {
            bleno.stopAdvertising();
        }
    });

    bleno.on('advertisingStart', function(err) {
        console.log('nascent-datasync\tAdvertising Start: ' + (err ? 'error=' + err : 'success');

        if (err) {
            return;
        }

        self.eventCharacteristic = new NascentDataSyncEventCharacteristic(self);
        bleno.setServices([
            new bleno.PrimaryService({
                uuid: self.serviceUUID,
                characteristics: [
                    self.eventtCharacteristic
                ]
            })
        ]);
    });
}
util.inherits(NascentDataSync, EventEmitter);

NascentDataSync.prototype.sendEvent = function(eventName, args, cb) {
    if (!this.eventCharacteristic) {
        throw 'No event characteristic';
    }
    
    if (!this.eventCharacteristic.updateValueCallback) {
        throw 'No updateValueCallback';
    }

    var data = new Buffer(JSON.stringify({
        c: eventName,
        a: args
    }));
    this.eventCharacteristic.updateValueCallback(data);
};

NascentDataSync.updateData = function() {
};

module.exports = NascentDataSync;

