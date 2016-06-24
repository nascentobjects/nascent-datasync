/*
 * Copyright (c) 2015-2016, Nascent Objects Inc
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without 
 * modification, are permitted provided that the following conditions 
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright 
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright 
 *    notice, this list of conditions and the following disclaimer in 
 *    the documentation and/or other materials provided with the 
 *    distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its 
 *    contributors may be used to endorse or promote products derived 
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT 
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS 
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE 
 * COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, 
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, 
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; 
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER 
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT 
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN 
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
 * POSSIBILITY OF SUCH DAMAGE.
 */
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
            if (this.verbose) {
                console.log('nascent-datasync\tEmitting Event: ' + cmd.c + ' ' + JSON.stringify(cmd.a));
            }
            this.dataSync.emit(cmd.c, cmd.a);
            break;
        case NascentDataFlagChunkFull:
            this.pendingData = '' + str.slice(1);
            var cmd = JSON.parse('' + this.pendingData);
            this.pendingData = '';
            if (this.verbose) {
                console.log('nascent-datasync\tEmitting Event: ' + cmd.c + ' ' + JSON.stringify(cmd.a));
            }
            this.dataSync.emit(cmd.c, cmd.a);
            break;
        case NascentDataFlagChunkMiddle:
            this.pendingData += '' + str.slice(1);
            break;
    }

    callback(this.RESULT_SUCCESS);
};

NascentDataSyncEventCharacteristic.prototype.onNotify = function() {
    if (this.verbose) {
        console.log('nascent-datasync\tOnNotify');
    }
    var self = this;
    setTimeout(function() {
        self.sendNextChunk();
    }, 50);
};

NascentDataSyncEventCharacteristic.prototype.sendNextChunk = function() {
    var self = this;

    if (this.pendingWriteChunks.length === 0) {
        this.sendingChunks = false;
        if (this.verbose) {
            console.log('nascent-datasync\tNo chunk to send');
        }
        return;
    }

    if (!this.updateValueCallback) {
        setTimeout(function() {
            self.sendNextChunk();
        }, 100);
        return;
    }

    if (this.verbose) {
        console.log('nascent-datasync\tSending Chunk Data: ' + this.pendingWriteChunks[0][0] + ' ' + this.pendingWriteChunks[0].length);
    }
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
    if (options.verbose) {
        this.verbose = true;
    }

    this.serviceUUID = '686c3dbf2f844eb88e620c12fc534f7c';
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
                var deviceName = process.env.BLENO_DEVICE_NAME || os.hostname();
                bleno.startAdvertising(deviceName, [self.serviceUUID]);
            } else {
                bleno.stopAdvertising();
            }
        });

        bleno.on('advertisingStart', function(err) {
            if (self.verbose) {
                console.log('nascent-datasync\tAdvertising Start: ' + (err ? ('error=' + err) : 'success'));
            }

            if (err) {
                return;
            }

            self.eventCharacteristic = new NascentDataSyncEventCharacteristic(self);
            self.eventCharacteristic.verbose = self.verbose;
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
            if (self.verbose) {
                console.log('nascent-datasync\tAdvertising Start Error: ' + JSON.stringify(err));
            }
        });

        bleno.on('advertisingStop', function() {
            if (self.verbose) {
                console.log('nascent-datasync\tAdvertising Stop');
            }
        });

        bleno.on('accept', function(clientAddress) {
            if (self.verbose) {
                console.log('nascent-datasync\tAccepting client address: ' + JSON.stringify(clientAddress));
            }
            self.emit('connected');
        });

        bleno.on('disconnect', function(clientAddress) {
            if (self.verbose) {
                console.log('nascent-datasync\tDisconnecting client address: ' + JSON.stringify(clientAddress));
            }
            self.emit('disconnected');
        });
    }
}
util.inherits(NascentDataSync, EventEmitter);

NascentDataSync.prototype.stop = function() {
    bleno.stopAdvertising();
};

NascentDataSync.prototype.sendEventLowPriority = function(eventName, args) {
    var self = this;

    if (!self.eventCharacteristic) {
        return;
    }
    if (!self.eventCharacteristic.updateValueCallback) {
        return;
    }

    var json = JSON.stringify({
        c: eventName,
        a: args
    });

    if (self.verbose) {
        console.log('nascent-datasync\tSending Event: ' + eventName + ' ' + JSON.stringify(args));
    }
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

        self.eventCharacteristic.pendingWriteChunks.push(new Buffer(flag + json.slice(a, a+19)));
    }

    if (!self.eventCharacteristic.sendingChunks) {
        self.eventCharacteristic.sendNextChunk();
    }
};

NascentDataSync.prototype.sendEvent = function(eventName, args) {
    var self = this;
    function trySendEvent() {
        if (!self.eventCharacteristic) {
            setTimeout(trySendEvent, 500);
            return;
        }
        var json = JSON.stringify({
            c: eventName,
            a: args
        });

        if (self.verbose) {
            console.log('nascent-datasync\tSending Event: ' + eventName + ' ' + JSON.stringify(args));
        }
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

            self.eventCharacteristic.pendingWriteChunks.push(new Buffer(flag + json.slice(a, a+19)));
        }

        if (!self.eventCharacteristic.sendingChunks) {
            self.eventCharacteristic.sendNextChunk();
        }
    }
    trySendEvent();
};

NascentDataSync.updateData = function() {
};

module.exports = NascentDataSync;

