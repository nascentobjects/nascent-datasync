var util = require('util');
var EventEmitter = require('events').EventEmitter;
var crypto = require('crypto');
var bleno = require('bleno');
var spawn = require('child_process').spawn;

// on: 'event'
// on: 'eventname'
// on: 'datachanged'
// on: 'connected'
// on: 'disconnected'

var NascentDataSyncCommandCharacteristicUUID = 'c50dc35b-9a1b-40c2-bc97-96ee7254579c';
var NascentDataFlagChunkStart = 'S';
var NascentDataFlagChunkEnd = 'E';
var NascentDataFlagChunkMiddle = 'M';
var NascentDataFlagChunkFull = 'F';


function NascentDataSyncEventCharacteristic(dataSync) {
    bleno.Characteristic.call(this, {
        uuid: NascentDataSyncCommandCharacteristicUUID,
        properties: ['write', 'notify'],
        value: null
    });

    this.dataSync = dataSync;
    this.pendingData = '';
    this.pendingWriteChunks = [];
}
util.inherits(NascentDataSyncEventCharacteristic, bleno.Characteristic);

NascentDataSyncEventCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
    var str = '' + data;
    switch (str[0]) {
        case NascentDataFlagChunkStart:
            this.pendingData = '' + str.slice(1);
            break;
        case NascentDataFlagChunkEnd:
            this.pendingData += '' + str.slice(1);
            var cmd = JSON.parse('' + this.pendingData);
            this.pendingData = '';
            this.dataSync.emit(cmd.c, cmd.a);
            break;
        case NascentDataFlagChunkFull:
            this.pendingData = '' + str.slice(1);
            var cmd = JSON.parse('' + this.pendingData);
            this.pendingData = '';
            this.dataSync.emit(cmd.c, cmd.a);
            break;
        case NascentDataFlagChunkMiddle:
            this.pendingData += '' + str.slice(1);
            break;
    }

    callback(this.RESULT_SUCCESS);
};

NascentDataSyncEventCharacteristic.prototype.onNotify = function() {
    console.log('nascent-datasync\tOnNotify');
    this.sendNextChunk();
};

NascentDataSyncEventCharacteristic.prototype.sendNextChunk = function() {
    var self = this;

    if (this.pendingWriteChunks.length === 0) {
        this.sendingChunks = false;
        console.log('nascent-datasync\tNo chunk to send');
        return;
    }

    if (!this.updateValueCallback) {
        setTimeout(function() {
            self.sendNextChunk();
        }, 100);
        return;
    }

    console.log('nascent-datasync\tSending Chunk Data: ' + this.pendingWriteChunks[0][0] + ' ' + this.pendingWriteChunks[0].length);
    this.sendingChunks = true;
    var data = this.pendingWriteChunks[0];
    this.pendingWriteChunks = this.pendingWriteChunks.slice(1);
    this.updateValueCallback(data);
};

function NascentDataSync(options) {
    if (!('id' in options)) {
        throw 'An id must be given';
    }
    EventEmitter.call(this);

    this.serviceUUID = '686c3dbf2f844eb88e620c12fc534f7b';
    //this.serviceUUID = 'n' + crypto.createHash('md5').update(options.id).digest('hex');
    this.data = {};
    var self = this;

    setupBleno();
    /*
    var reset = spawn('hciconfig', [ 'hci0', 'reset' ]);
    reset.on('close', function() {
        setTimeout(setupBleno, 1000);
    });
    */

    function setupBleno() {
        bleno.on('stateChange', function(state) {
            if (state === 'poweredOn') {
                bleno.startAdvertising('nascent', [self.serviceUUID]);
            } else {
                bleno.stopAdvertising();
            }
        });

        bleno.on('advertisingStart', function(err) {
            console.log('nascent-datasync\tAdvertising Start: ' + (err ? ('error=' + err) : 'success'));

            if (err) {
                return;
            }

            self.eventCharacteristic = new NascentDataSyncEventCharacteristic(self);
            bleno.setServices([
                new bleno.PrimaryService({
                    uuid: self.serviceUUID,
                    characteristics: [
                        self.eventCharacteristic
                    ]
                })
            ]);
        });
        
        bleno.on('advertisingStartError', function(err) {
            console.log('nascent-datasync\tAdvertising Start Error: ' + JSON.stringify(err));
        });

        bleno.on('advertisingStop', function() {
            console.log('nascent-datasync\tAdvertising Stop');
        });

        bleno.on('accept', function(clientAddress) {
            console.log('nascent-datasync\tAccepting client address: ' + JSON.stringify(clientAddress));
        });

        bleno.on('disconnect', function(clientAddress) {
            console.log('nascent-datasync\tDisconnecting client address: ' + JSON.stringify(clientAddress));
        });
    }
}
util.inherits(NascentDataSync, EventEmitter);

NascentDataSync.prototype.sendEvent = function(eventName, args) {
    function trySendEvent() {
        if (!this.eventCharacteristic) {
            setTimeout(trySendEvent, 500);
            return;
        }
        var json = JSON.stringify({
            c: eventName,
            a: args
        });


        var flag;
        for (var a=0; a<json.length; a+=19) {
            if (a === 0 && a+19 >= json.length) {
                flag = NascentDataFlagChunkFull;
            } else if (a+19 >= json.length) {
                flag = NascentDataFlagChunkEnd;
            } else if (a === 0) {
                flag = NascentDataFlagChunkStart;
            } else {
                flag = NascentDataFlagChunkMiddle;
            }

            this.eventCharacteristic.pendingWriteChunks.push(new Buffer(flag + json.slice(a, a+19)));
        }

        if (!this.sendingChunks) {
            this.eventCharacteristic.sendNextChunk();
        }
    }
};

NascentDataSync.updateData = function() {
};

module.exports = NascentDataSync;

