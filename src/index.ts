/**
 * Created by kizer on 17/07/2017.
 */
import config from './config';
import * as server from 'raspump-remote';
import * as iocl from 'socket.io-client';

// Connect to remote
const host = config.get('remoteHost');
const port = config.get('remotePort');
const localPort = config.get('localPort');
const client = iocl(`http://${host}:${port}`);

console.log('CONNECTING TO', `http://${host}:${port}`);

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
    console.log('STATUS FROM REMOTE', { deviceId, status, date });
    Raspump.syncStatus(deviceId, status, date)
        .then(e => {
            if (!e.modified) {
                // Received data is up to date (not modified), which means we changed our own record. Notify clients
                pubsub.publish(deviceId, 'status');
            }

            return e;
        })
        .then(e => console.log('STATUS', e, typeof date, deviceId, status, date))
        .catch(e => console.error(e));
});

client.emit('auth', { user: config.get('username'), password: config.get('password') }, e => {
    if (!e) {
        // Quit process
        throw new Error('Unable to connect to remote. Authentication failed');
    }

    client.emit('subscribe', 'system');
});

// Tell the

// Listen for incoming subscriptions
const clientConnections = {};

pubsub.subscribe('system', msg => {
    const {event, deviceId, socketId} = msg;
    console.log('SYSTEM', msg, typeof msg);

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

function clientSubscribe(deviceId: string, socketId: string) {
    const coll = clientConnections[deviceId] || (clientConnections[deviceId] = {sockets: []});
    coll.sockets.push(socketId);
    console.log('NEW SUBSCRIPTION', {deviceId, socketId}, coll.sockets.length);

    if (coll.sockets.length === 1) {
        // This is the first subscription to this device, subscribe to the server
        client.emit('subscribe', deviceId, a => console.log('SUBSCRIBED TO REMOTE', a, deviceId));

        // When items are modified locally, tell the remote
        coll.unsub = pubsub.subscribe(deviceId, async () => {
            if (deviceId === 'system') {
                // Do not sync system events
                return;
            }

            const data = await Raspump.getStatusAndDate(deviceId);
            client.emit('syncStatus', { deviceId, ...data });
        });
    }
}

function clientUnsubscribe(deviceId: string, socketId: string) {
    const coll = clientConnections[deviceId] || {};
    coll.sockets = (coll.sockets || []).filter(sid => sid !== socketId);

    if (coll.sockets.length === 0) {
        // No one is now listening on this device, unsubscribe
        client.emit('unsubscribe', deviceId);
        coll.unsub && coll.unsub();
    }
}

function upstreamCreateUser(user: string, password: string) {
    client.emit('createUser', {user, password});
}

// Listen for connections
server.socket.startSocket(config.get('localPort'));
console.log('LISTENING ON', localPort);
