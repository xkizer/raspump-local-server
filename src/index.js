"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Created by kizer on 17/07/2017.
 */
const config_1 = require("./config");
const server = require("raspump-remote");
const iocl = require("socket.io-client");
// Connect to remote
const host = config_1.default.get('remoteHost');
const port = config_1.default.get('remotePort');
const client = iocl(`http://${host}:${port}`);
const pubsub = server.pubsub;
const Raspump = server.Raspump;
// Be notified when system events happen on the remote server
client.on('system', evt => {
    if (evt.event !== 'createUser') {
        // We are not interested
        return;
    }
    const { user, password } = evt;
    pubsub.createUser(user, password).catch(e => console.error(e));
});
client.on('status', ({ deviceId, status, date }) => {
    Raspump.syncStatus(deviceId, status, date)
        .then(e => {
        if (e.modified) {
            // Modified, notify clients
            return pubsub.publish(deviceId, 'status');
        }
    }).then(e => console.error(e));
});
client.emit('subscribe', 'system');
client.emit('subscribe', 'update');
// When items are modified locally, tell the remote
// Listen for incoming subscriptions
const clientConnections = {};
pubsub.subscribe('system', msg => {
    const { event, deviceId, socketId } = msg;
    switch (event) {
        case 'subscribe':
            clientSubscribe(deviceId, socketId);
            break;
        case 'unsubscribe':
            clientUnsubscribe(deviceId, socketId);
            break;
        case 'createUser':
            upstreamCreateUser(msg.user, msg.password);
            break;
    }
});
function clientSubscribe(deviceId, socketId) {
    const coll = clientConnections[deviceId] || (clientConnections[deviceId] = []);
    coll.push(socketId);
    if (coll.length === 1) {
        // This is the first subscription to this device, subscribe to the server
        client.emit('subscribe', deviceId);
    }
}
function clientUnsubscribe(deviceId, socketId) {
    const coll = clientConnections[deviceId] || [];
    clientConnections[deviceId] = coll.filter(sid => sid !== socketId);
    if (clientConnections[deviceId] === 0) {
        // No one is now listening on this device, unsubscribe
        client.emit('unsubscribe', deviceId);
    }
}
function upstreamCreateUser(user, password) {
    client.emit('createUser', { user, password });
}
// Listen for connections
server.socket.startSocket(config_1.default.get('localPort'));
console.log('LISTENING ON', config_1.default.get('localPort'));
//# sourceMappingURL=index.js.map