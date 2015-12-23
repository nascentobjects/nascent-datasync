var bluetoothle;

function NascentDataSync(options) {
    EventEmitter.call(this);

    if (!('id' in options)) {
        throw 'An id must be given';
    }

    this.DataFlagChunkStart = 'S';
    this.DataFlagChunkEnd = 'E';
    this.DataFlagChunkMiddle = 'M';
    this.DataFlagChunkFull = 'F';
    this.NascentDataSyncCommandCharacteristicUUID = 'c50dc35b-9a1b-40c2-bc97-96ee7254579c';
    this.serviceUUID = '686c3dbf-2f84-4eb8-8e62-0c12fc534f7b';
    this.connectedAddress = null;
    this.pendingConnectSuccessCbs = [];
    this.pendingConnectErrorCbs = [];
    this.pendingChunks = [];
    this.pendingSubscribeData = '';

    this.whenConnected(function(result) {
        console.log('CONNECTED');
    }, function(err, stage) {
        console.log('ERROR');
    });
}

/*!
 *  EventEmitter v4.1.0 - git.io/ee
 *  Oliver Caldwell
 *  MIT license
 *  @preserve
 */
!function(r){"use strict";function t(){}function n(n,e){if(i)return e.indexOf(n);for(var t=e.length;t--;)if(e[t]===n)return t;return-1}var e=t.prototype,i=Array.prototype.indexOf?!0:!1;e._getEvents=function(){return this._events||(this._events={})},e.getListeners=function(n){var r,e,t=this._getEvents();if("object"==typeof n){r={};for(e in t)t.hasOwnProperty(e)&&n.test(e)&&(r[e]=t[e])}else r=t[n]||(t[n]=[]);return r},e.getListenersAsObject=function(n){var e,t=this.getListeners(n);return t instanceof Array&&(e={},e[n]=t),e||t},e.addListener=function(i,r){var e,t=this.getListenersAsObject(i);for(e in t)t.hasOwnProperty(e)&&-1===n(r,t[e])&&t[e].push(r);return this},e.on=e.addListener,e.defineEvent=function(e){return this.getListeners(e),this},e.defineEvents=function(t){for(var e=0;e<t.length;e+=1)this.defineEvent(t[e]);return this},e.removeListener=function(i,s){var r,e,t=this.getListenersAsObject(i);for(e in t)t.hasOwnProperty(e)&&(r=n(s,t[e]),-1!==r&&t[e].splice(r,1));return this},e.off=e.removeListener,e.addListeners=function(e,t){return this.manipulateListeners(!1,e,t)},e.removeListeners=function(e,t){return this.manipulateListeners(!0,e,t)},e.manipulateListeners=function(r,t,i){var e,n,s=r?this.removeListener:this.addListener,o=r?this.removeListeners:this.addListeners;if("object"!=typeof t||t instanceof RegExp)for(e=i.length;e--;)s.call(this,t,i[e]);else for(e in t)t.hasOwnProperty(e)&&(n=t[e])&&("function"==typeof n?s.call(this,e,n):o.call(this,e,n));return this},e.removeEvent=function(n){var e,r=typeof n,t=this._getEvents();if("string"===r)delete t[n];else if("object"===r)for(e in t)t.hasOwnProperty(e)&&n.test(e)&&delete t[e];else delete this._events;return this},e.emitEvent=function(r,i){var n,e,s,t=this.getListenersAsObject(r);for(e in t)if(t.hasOwnProperty(e))for(n=t[e].length;n--;)s=i?t[e][n].apply(null,i):t[e][n](),s===!0&&this.removeListener(r,t[e][n]);return this},e.trigger=e.emitEvent,e.emit=function(e){var t=Array.prototype.slice.call(arguments,1);return this.emitEvent(e,t)},"function"==typeof define&&define.amd?define(function(){return t}):r.EventEmitter=t}(this);



NascentDataSync.prototype = Object.create(EventEmitter.prototype);
NascentDataSync.prototype.constructor = NascentDataSync;

NascentDataSync.prototype.whenConnected = function(successCb, errCb) {
    var self = this;

    function deferCbs() {
        if (successCb) {
            self.pendingConnectSuccessCbs.push(successCb);
        }
        if (errCb) {
            self.pendingConnectErrorCbs.push(errCb);
        }
    }

    function initialize(successCb, errCb) {
        console.log('Initializing');
        bluetoothle.initialize(function(result) {
            startScan(successCb, deferCbs);
        }, function(err) {
            console.log('Initialize err: ' + JSON.stringify(err));
            if (errCb) {
                errCb(err, 'initialize');
            }
        });
    }

    function startScan(successCb, errCb) {
        console.log('Starting Scan');
        bluetoothle.startScan(function(result) {
            console.log('Scan Result: ' + JSON.stringify(result));
            if (result.status === 'scanResult' && result.name === 'nascent') {
                connectDevice(result.address, successCb, errCb);
            }
        }, function(err) {
            console.log('Start Scan Error: ' + JSON.stringify(err));
            if (errCb) {
                errCb(err, 'startScan');
            }
        }, {
            serviceUuids: []
        });
    }

    function connectDevice(address, successCb, errCb) {
        bluetoothle.stopScan();
        setTimeout(function() {
            console.log('BLAH CONNECTING: ' + address);
            bluetoothle.connect(function(result) {
                console.log('Connect Status: ' + result.status);
                if (result.status === 'connected') {
                    console.log('Connect Result: ' + JSON.stringify(result));
                    discoverDevice(address, successCb, errCb);
                } else if (result.status === 'disconnected' && result.address === self.connectedAddress) {
                    console.log('Disconnected on connected address.  Try reconnecting');
                    self.whenConnected(function() {
                        console.log('Reconnected after disconnect');
                    });
                }
            }, function(err) {
                console.log('Connect Error: ' + JSON.stringify(err));
                reconnectDevice(address, successCb, errCb);
            }, {
                address: address
            });
        }, 1000);
    }

    function reconnectDevice(address, successCb, errCb) {
        if (self.connectedAddress) {
            console.log('Reconnect: Have Connected Address');
            // seems like we managed to connect to another device successfully
            return;
        }
        function reconnect() {
            setTimeout(function() {
                console.log('Reconnecting: ' + address);
                bluetoothle.reconnect(function(result) {
                    console.log('Reconnect Status: ' + result.status);
                    if (result.status === 'connected') {
                        console.log('Reconnect result: ' + JSON.stringify(result));
                        discoverDevice(address, successCb, errCb);
                    }
                }, function(err) {
                    console.log('Reconnect Error: ' + JSON.stringify(err));
                    reconnectDevice(address, successCb, errCb);
                }, {
                    address: address
                });
            }, 100);
        }

        bluetoothle.disconnect(function(result) {
            reconnect();
        }, function(err) {
            reconnect();
        }, {
            address: address
        });

    }

    function subscribeDevice(address, successCb, errCb) {
        console.log('SUBSCRIBING: ' + address);
        bluetoothle.subscribe(function(result) {
            if (result.status === 'subscribed') {
                console.log('Successfully subscribed');
                bluetoothle.stopScan();
                self.connectedAddress = result.address;
                if (successCb) {
                    successCb(result);
                }
            } else if (result.status === 'subscribedResult') {
                var v = bluetoothle.bytesToString(bluetoothle.encodedStringToBytes(result.value));
                console.log('Received: ' + v);
                switch (v[0]) {
                    case self.DataFlagChunkStart:
                        self.pendingSubscribeData = v.slice(1);
                        break;
                    case self.DataFlagChunkMiddle:
                        self.pendingSubscribeData += v.slice(1);
                        break;
                    case self.DataFlagChunkEnd:
                        self.pendingSubscribeData += v.slice(1);
                        self.receivedEventData(self.pendingSubscribeData);
                        self.pendingSubscribeData = '';
                        break;
                    case self.DataFlagChunkFull:
                        self.pendingSubscribeData = v.slice(1);
                        self.receivedEventData(self.pendingSubscribeData);
                        self.pendingSubscribeData = '';
                        break;
                }
            }
        }, function(err) {
            if (errCb) {
                errCb(err, 'subscribe');
            }
        }, {
            address: address,
            serviceUuid: self.serviceUUID,
            characteristicUuid: self.NascentDataSyncCommandCharacteristicUUID,
            isNotification: true
        });
    }

    function discoverDevice(address, successCb, errCb) {
        setTimeout(function() {
            console.log('Discovering: ' + address);
            bluetoothle.discover(function(result) {
                var found = false;
                for (var a=0; a<result.services.length; ++a) {
                    if (result.services[a].serviceUuid === self.serviceUUID) {
                        found = true;
                        break;
                    } else {
                        console.log(result.services[a].serviceUuid + ' not ' + self.serviceUUID);
                    } 
                }
                if (found) {
                    console.log('Connected');
                    subscribeDevice(address, successCb, errCb);
                }
            }, function(err) {
                console.log('Discover error: ' + JSON.stringify(err));
                if (errCb) {
                    errCb(err, 'discover');
                }
            }, {
                address: address
            });
        }, 1500);
    }

    function success(result) {
        console.log('BLE SUCCESS');
        var a;

        successCb(result);

        for (a=0; a<self.pendingConnectSuccessCbs.length; ++a) {
            self.pendingConnectSuccessCbs[a](result);
        }

        self.pendingConnectSuccessCbs = [];
        self.pendingConnectErrorCbs = [];
    }

    function fail(err, stage) {
        console.log('Error in ' + stage + ': ' + JSON.stringify(err));
        var a;

        errCb(err, stage);

        for (a=0; a<self.pendingConnectErrorCbs.length; ++a) {
            self.pendingConnectErrorCbs[a](err, stage);
        }

        self.pendingConnectSuccessCbs = [];
        self.pendingConnectErrorCbs = [];
    }

    function tryInitialize() {
        bluetoothle.isInitialized(function(result) {
            if (result.isInitialized) {
                bluetoothle.isScanning(function(result) {
                    if (result.isScanning) {
                        console.log('Already initialized and scanning.  Just wait for other result');
                        deferCbs();
                    } else {
                        console.log('Already initialized but will start scanning');
                        startScan(success, deferCbs);
                    }
                });
            } else {
                console.log('Not initialized.  Will do so');
                initialize(success, fail)
            } 
        });
    }

    if (!self.connectedAddress) {
        tryInitialize();
    } else {
        bluetoothle.isConnected(function(result) {
            if (result.isConnected) {
                successCb({
                    address: self.connectedAddress
                });
            } else {
                delete self.connectedAddress;
                tryInitialize();
            }
        }, function(err) {
            delete self.connectedAddress;
            tryInitialize();
        }, {
            address: self.connectedAddress
        });
    }
};

NascentDataSync.prototype.receivedEventData = function(json) {
    var obj = JSON.parse(json);
    this.emit(obj.c, obj.a);
};

NascentDataSync.prototype.sendEvent = function(eventName, args) {
    var self = this;
    this.whenConnected(function(result) {
        var json;

        if (args) {
            json = '{"c":"' + eventName + '","a":' + JSON.stringify(args) + '}';
        } else {
            json = '{"c":"' + eventName + '"}';
        }

        var flag;
        var data;
        for (var a=0; a<json.length; a+=19) {
            if (a === 0 && a+19 >= json.length) {
                flag = self.DataFlagChunkFull;
            } else if (a+19 >= json.length) {
                flag = self.DataFlagChunkEnd;
            } else if (a === 0) {
                flag = self.DataFlagChunkStart;
            } else {
                flag = self.DataFlagChunkMiddle;
            }
            var data = flag + json.slice(a, a+19);
            self.pendingChunks.push(data);
        }

        function processNextChunk() {
            if (self.pendingChunks.length === 0) {
                self.processingSendChunks = false;
                return;
            }

            var chunk = self.pendingChunks[0];
            self.pendingChunks = self.pendingChunks.slice(1);
            var v = bluetoothle.bytesToEncodedString(bluetoothle.stringToBytes(chunk));
            bluetoothle.write(function(result) {
                processNextChunk();
            }, function(err) {
                console.log('Write Error: ' + JSON.stringify(err));
                throw err;
            }, {
                address: self.connectedAddress,
                value: v,
                serviceUuid: self.serviceUUID,
                characteristicUuid: self.NascentDataSyncCommandCharacteristicUUID
            });
        }

        if (!self.processingSendChunks) {
            self.processingSendChunks = true;
            processNextChunk();
        }
    });
};

/*!
 *  EventEmitter v4.1.0 - git.io/ee
 *  Oliver Caldwell
 *  MIT license
 *  @preserve
 */
!function(r){"use strict";function t(){}function n(n,e){if(i)return e.indexOf(n);for(var t=e.length;t--;)if(e[t]===n)return t;return-1}var e=t.prototype,i=Array.prototype.indexOf?!0:!1;e._getEvents=function(){return this._events||(this._events={})},e.getListeners=function(n){var r,e,t=this._getEvents();if("object"==typeof n){r={};for(e in t)t.hasOwnProperty(e)&&n.test(e)&&(r[e]=t[e])}else r=t[n]||(t[n]=[]);return r},e.getListenersAsObject=function(n){var e,t=this.getListeners(n);return t instanceof Array&&(e={},e[n]=t),e||t},e.addListener=function(i,r){var e,t=this.getListenersAsObject(i);for(e in t)t.hasOwnProperty(e)&&-1===n(r,t[e])&&t[e].push(r);return this},e.on=e.addListener,e.defineEvent=function(e){return this.getListeners(e),this},e.defineEvents=function(t){for(var e=0;e<t.length;e+=1)this.defineEvent(t[e]);return this},e.removeListener=function(i,s){var r,e,t=this.getListenersAsObject(i);for(e in t)t.hasOwnProperty(e)&&(r=n(s,t[e]),-1!==r&&t[e].splice(r,1));return this},e.off=e.removeListener,e.addListeners=function(e,t){return this.manipulateListeners(!1,e,t)},e.removeListeners=function(e,t){return this.manipulateListeners(!0,e,t)},e.manipulateListeners=function(r,t,i){var e,n,s=r?this.removeListener:this.addListener,o=r?this.removeListeners:this.addListeners;if("object"!=typeof t||t instanceof RegExp)for(e=i.length;e--;)s.call(this,t,i[e]);else for(e in t)t.hasOwnProperty(e)&&(n=t[e])&&("function"==typeof n?s.call(this,e,n):o.call(this,e,n));return this},e.removeEvent=function(n){var e,r=typeof n,t=this._getEvents();if("string"===r)delete t[n];else if("object"===r)for(e in t)t.hasOwnProperty(e)&&n.test(e)&&delete t[e];else delete this._events;return this},e.emitEvent=function(r,i){var n,e,s,t=this.getListenersAsObject(r);for(e in t)if(t.hasOwnProperty(e))for(n=t[e].length;n--;)s=i?t[e][n].apply(null,i):t[e][n](),s===!0&&this.removeListener(r,t[e][n]);return this},e.trigger=e.emitEvent,e.emit=function(e){var t=Array.prototype.slice.call(arguments,1);return this.emitEvent(e,t)},"function"==typeof define&&define.amd?define(function(){return t}):r.EventEmitter=t}(this);
