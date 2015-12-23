var NascentDataSync = require('./index.js');

var dataSync = new NascentDataSync({
    id: 'com.nascentobjects.datasync-blehost'
});

dataSync.on('loopback', function(delay) {
    console.log('Loopback: ' + delay);
    setTimeout(function() {
        console.log('Sending Response');
        dataSync.sendEvent('pong', [1, 2, 3, 23, 5]);
    }, delay);
});

