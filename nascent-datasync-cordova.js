var bluetoothle;

function NascentDataSync(options) {
    var NascentDataSyncCommandCharacteristicUUID = 'c50dc35b-9a1b-40c2-bc97-96ee7254579c';

    if (!('id' in options)) {
        throw 'An id must be given';
    }

    this.serviceUUID = '686c3dbf2f844eb88e620c12fc534f7b';
    this.connectedAddress = null;

    var self = this;
    bluetoothle.initialize(function() {
        bluetoothle.startScan(function(result) {
            if (result.status === 'connected') {
                bluetoothle.stopScan();
                self.connectedAddress = result.address;
                bluetoothle.subscribe(function(result) {
                    if (result.status === 'subscribedResult') {
                        var val = bluetoothle.bytesToString(bluetoothle.encodedStringToBytes(result.value));
                        console.log('Event: ' + val);
                    }
                }, function(err) {
                    throw 'subscribe error ' + err;
                }, {
                    address: self.connectedAddress,
                    serviceUuid: self.serviceUUID,
                    characteristicUuid: NascentDataSyncCommandCharacteristicUUID,
                    isNotification: false
                });
            }
        }, function(err) {
            throw 'start scan error ' + err;
        }, {
            serviceUuids: [ self.serviceUUID ]
        });

    }, function(err) {
        throw 'initialize error: ' + err;
    });
}

NascentDataSync.prototype.sendEvent = function(eventName, args) {
    if (!this.connectedAddress) {
        return;
    }

    var json = '{c:"' + eventName + '",a:' + JSON.stringify(args) + '}';
    bluetoothle.write(function(result) {
    }, function(err) {
        throw err;
    }, {
        address: this.connectedAddress,
        value: bluetoothle.bytesToEncodedString(bluetoothle.stringToBytes(json)),
        serviceUuid: this.serviceUUID,
        characteristicUuid: NascentDataSyncCommandCharacteristicUUID
    });
}
