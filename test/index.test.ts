/**
 * Created by kizer on 18/07/2017.
 */
import * as chai from 'chai';
import * as asPromised from 'chai-as-promised';
import * as spies from 'chai-spies';
import { expect } from 'chai';
import * as iocl from 'socket.io-client';

// import { pubsub } from  '../src/pubsub';
import config from '../src/config';

const deviceId = 'test-device';
chai.use(asPromised);
chai.use(spies);

// Connect to remote
const host = config.get('remoteHost');
const port = config.get('remotePort');
const localPort = config.get('localPort');

const remote = iocl(`http://${host}:${port}`);
let local;

// Start the index
require('../src/index');

describe('Index', () => {
    before(() => {
        local = iocl(`http://localhost:${localPort}`);
    });

    after(() => {
        local.disconnect();
    });

    describe('connecting', () => {
        it('should connect to the local server', () => {
            const spy = chai.spy();
            const conn = iocl(`http://localhost:${localPort}`);
            conn.on('connect', spy);
            return wait(100).then(() => {
                conn.disconnect();
                return expect(spy).to.have.been.called();
            });
        });
    });

    describe('auth', () => {
        it('should connect to the local server', () => {
            const spy = chai.spy();
            const falseSpy = chai.spy();
            local.emit('auth', {user: 'kizer', password: 'pass33'}, spy);
            local.emit('auth', {user: 'unknown', password: 'pass33'}, falseSpy);
            return wait(100).then(() => {
                return Promise.all([
                    expect(spy).to.have.been.called.with(true),
                    expect(falseSpy).to.have.been.called.with(false),
                ]);
            });
        });
    });

    describe('subscribe', () => {
        it('should subscribe', () => {
            const spy = chai.spy();

            local.emit('auth', {user: 'kizer', password: 'pass33'}, () => {
                local.emit('subscribe', deviceId, spy);
            });

            return wait(100).then(() => {
                return Promise.all([
                    expect(spy).to.have.been.called.once,
                ]);
            });
        });

        it('should receive updates', () => {
            let callArgs;

            local.on('status', args => callArgs = args);
            local.emit('setStatus', {deviceId, status: true});

            return wait(100).then(() => {
                expect(callArgs).to.have.property('status').equal(true);
                expect(callArgs).to.have.property('deviceId').equal(deviceId);
            });
        });
    });

    describe('sync', () => {
        it('should sync with the remote server when values are updated on remote', async () => {
            let callArgs;

            local.emit('auth', {user: 'kizer', password: 'pass33'}, () => {
                local.emit('subscribe', deviceId, () => console.log('Subscribed to device', deviceId));
                local.on('status', args => callArgs = args);
            });

            remote.emit('auth', {user: 'kizer', password: 'pass33'}, () => {
                remote.emit('setStatus', {deviceId, status: false});
            });

            await wait(100);
            expect(callArgs).to.have.property('status').equal(false);
            expect(callArgs).to.have.property('deviceId').equal(deviceId);

            remote.emit('setStatus', {deviceId, status: true});
            await wait(100);
            expect(callArgs).to.have.property('status').equal(true);
            expect(callArgs).to.have.property('deviceId').equal(deviceId);
        });

        it('should sync to the remote server when values are updated locally', async () => {
            let callArgs;

            local.emit('auth', {user: 'kizer', password: 'pass33'});

            remote.emit('auth', {user: 'kizer', password: 'pass33'}, () => {
                remote.emit('subscribe', deviceId, () => console.log('Subscribed to device', deviceId));
                remote.on('status', args => callArgs = args);
                local.emit('setStatus', {deviceId, status: false});
            });

            await wait(1000);
            expect(callArgs).to.have.property('status').equal(false);
            expect(callArgs).to.have.property('deviceId').equal(deviceId);

            local.emit('setStatus', {deviceId, status: true});
            await wait(100);
            expect(callArgs).to.have.property('status').equal(true);
            expect(callArgs).to.have.property('deviceId').equal(deviceId);
        });
    });
});

function wait(millis): Promise<any> {
    return new Promise(res => setTimeout(res, millis));
}
