const http = require('http');
const eetase = require('eetase');
const socketClusterServer = require('socketcluster-server');
const express = require('express');
const serveStatic = require('serve-static');
const path = require('path');
const morgan = require('morgan');
const uuid = require('uuid');
const sccBrokerClient = require('scc-broker-client');
const request = require('request-json');
const url = require('url');
const Redis = require("ioredis");

require( 'console-stamp' )( console, {
    format: ':date(yyyy/mm/dd HH:MM:ss.l)'
});

// dotenv_config_path
require('dotenv').config({path: '.env'})
require('dotenv').config({path: '../.env'})

const ENVIRONMENT = process.env.APP_ENV || 'local';
const SOCKETCLUSTER_PORT = process.env.SOCKETCLUSTER_PORT || 8001;
const SOCKETCLUSTER_WS_ENGINE = process.env.SOCKETCLUSTER_WS_ENGINE || 'ws';
const SOCKETCLUSTER_SOCKET_CHANNEL_LIMIT = Number(process.env.SOCKETCLUSTER_SOCKET_CHANNEL_LIMIT) || 1000;
const SOCKETCLUSTER_LOG_LEVEL = process.env.SOCKETCLUSTER_LOG_LEVEL || 2;

const SCC_INSTANCE_ID = uuid.v4();
const SCC_STATE_SERVER_HOST = process.env.SCC_STATE_SERVER_HOST || null;
const SCC_STATE_SERVER_PORT = process.env.SCC_STATE_SERVER_PORT || null;
const SCC_MAPPING_ENGINE = process.env.SCC_MAPPING_ENGINE || null;
const SCC_CLIENT_POOL_SIZE = process.env.SCC_CLIENT_POOL_SIZE || null;
const SCC_AUTH_KEY = process.env.SCC_AUTH_KEY || null;
const SCC_INSTANCE_IP = process.env.SCC_INSTANCE_IP || null;
const SCC_INSTANCE_IP_FAMILY = process.env.SCC_INSTANCE_IP_FAMILY || null;
const SCC_STATE_SERVER_CONNECT_TIMEOUT = Number(process.env.SCC_STATE_SERVER_CONNECT_TIMEOUT) || null;
const SCC_STATE_SERVER_ACK_TIMEOUT = Number(process.env.SCC_STATE_SERVER_ACK_TIMEOUT) || null;
const SCC_STATE_SERVER_RECONNECT_RANDOMNESS = Number(process.env.SCC_STATE_SERVER_RECONNECT_RANDOMNESS) || null;
const SCC_PUB_SUB_BATCH_DURATION = Number(process.env.SCC_PUB_SUB_BATCH_DURATION) || null;
const SCC_BROKER_RETRY_DELAY = Number(process.env.SCC_BROKER_RETRY_DELAY) || null;
const inDevMode = ENVIRONMENT === 'local' || ENVIRONMENT === 'dev';

console.info(`Using WS engine "${SOCKETCLUSTER_WS_ENGINE}"`);
let agOptions = {};
let subscribers = [];
// SOCKETCLUSTER_OPTIONS='{"protocolVersion": 1,"path": "/socketcluster/"}'

if (process.env.SOCKETCLUSTER_OPTIONS) {
  let envOptions = JSON.parse(process.env.SOCKETCLUSTER_OPTIONS);
  Object.assign(agOptions, envOptions);
}

let httpServer = eetase(http.createServer());
let agServer = socketClusterServer.attach(httpServer, agOptions);

let expressApp = express();
if (inDevMode) {
  // Log every HTTP request. See https://github.com/expressjs/morgan for other
  // available formats.
  expressApp.use(morgan('dev'));
}

//logging middleware
expressApp.use(function(req, res, next) {
    if (res.headersSent) {
        console.log(`headers sent ${colorText(req.method, 32)} ${req.url} ${res.statusCode}`);
    } else {
        res.on('finish', function() {
            console.log(`${colorText(req.method, 32)} ${req.url} ${res.statusCode}`);
        })
    }
    next();
});

expressApp.use(serveStatic(path.resolve(__dirname, 'public')));

// Add GET /health-check express route
expressApp.get('/health-check', (req, res) => {
  res.status(200).send('OK');
});


let redis;
let redisKeyPrefix = process.env.REDIS_KEY_PREFIX || '';
let redis_password = null;

if(process.env.BROADCAST_DRIVER === 'redis'){
    if(process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD !== "null"){
        redis_password = process.env.REDIS_PASSWORD;
    }
    redis = new Redis({
        port: process.env.REDIS_PORT || 6379, // Redis port
        host: process.env.REDIS_HOST || "127.0.0.1", // Redis host
        //username: "default", // needs Redis >= 6
        password: redis_password,
        //db: 0, // Defaults to 0
    });
}

// this returns a promise
let subscribeToRedisPubChannel = (callback) => {
    return new Promise((resolve, reject) => {
        redis.on('pmessage', (subscribed, channel, message) => {
            try {
                message = JSON.parse(message);

                if (inDevMode) {
                    console.info("Channel: " + channel);
                    console.info("Event: " + message.event);
                }

                callback(channel.substring(redisKeyPrefix.length), message);
            } catch (e) {
                if (inDevMode) {
                    console.info("No JSON message");
                }
            }
        });

        redis.psubscribe(`${redisKeyPrefix}*`, (err, count) => {
            if (err) {
                reject('Redis could not subscribe.')
            }

            console.log('Listening for redis events...');

            resolve();
        });
    });
}

let unsubscribeToRedisPubChannel = () => {
    return new Promise((resolve, reject) => {
        try {
            redis.disconnect();
            resolve();
        } catch(e) {
            reject('Could not disconnect from redis -> ' + e);
        }
    });
}

if(process.env.BROADCAST_DRIVER === 'redis') {
    console.log("Using REDIS for pub/sub");
    subscribeToRedisPubChannel((channel, message) => {
        (async () => {
            agServer.exchange.transmitPublish(channel, message);
        })();
        console.log('Published message on '+channel);
    })
}else if(process.env.BROADCAST_DRIVER === 'echosocketcluster'){
    // support http publishing
    console.log("Using HTTP for pub/sub");
    expressApp.post('/api/publish', function(req, res){
        let body = "";
        req.on('data', function(chunk) {
            body += chunk;
        });
        req.on('end', function() {
            let json;
            try{
                json = JSON.parse(body.trim());
                // console.log(json);
                if(json.token && process.env.SOCKETCLUSTER_HTTP_TOKEN){
                    if(json.token !== process.env.SOCKETCLUSTER_HTTP_TOKEN){
                        console.error('Error publishing message. Key mismatch.');
                        res.send('failed publishing message: Key mismatch');
                        return;
                    }
                }
                (async () => {
                    agServer.exchange.transmitPublish(json.channel, json.data);
                })();
                //agServer.exchange.transmitPublish(json.channel, json.data);
                console.log('Published message on '+json.channel);
                res.send('published message: '+body+' and delivered to channel: '+json.channel);
            }catch (e) {
                console.error('Error publishing message');
                res.send('failed publishing message: '+e.message);
            }
        });
    });
}

// HTTP request handling loop.
(async () => {
  for await (let requestData of httpServer.listener('request')) {
    expressApp.apply(null, requestData);
  }
})();

// laravel echo ported functions

// port from laravel echo server

let _clientEvents = ['client-*'];
let _privateChannels = ['private-*', 'presence-*'];

let clientEvent = function(socket, data){
    if (data.event && data.channel) {
        if (isClientEvent(data.event) &&
            isPrivate(data.channel)) {

            let dataChannel = socket.channel(data.channel);
            dataChannel.transmitPublish(data);
        }
    }
};

let serverRequest = function(socket, options){
    return new Promise((resolve, reject) => {
        options.headers = prepareHeaders(socket, options);
        options.form = prepareForm(socket, options);
        let body;

        // sending request to the authentication endpoint on the laravel application
        console.log("Requesting url: "+options.url);

        let url_info = url.parse(options.url);
        let client = request.createClient(url_info.protocol+'//'+url_info.host);

        client.headers = options.headers || {};
        client.post(url_info.path, options.form)
            .then(result => {
                if(result.res.statusCode !== 200){
                    if(result.res.body && result.res.body.message){
                        reject({ reason: `Error sending authentication request. ${result.res.body.message}`, status: 0 });
                    }else{
                        reject({ reason: 'Error sending authentication request.', status: 0 });
                    }
                    return;
                }
                let body = result.body;

                if(typeof body === "string" && body.indexOf("{") === 0){
                    body = JSON.parse(body);
                }

                if (inDevMode) {
                    if(options.form.channel_name){
                        console.info(`[${new Date().toLocaleTimeString()}] - ${socket.id} authenticated for: ${options.form.channel_name}`);
                    }
                }
                resolve(body);
            })
            .catch(error => {
                if (inDevMode) {
                    console.error(`[${new Date().toLocaleTimeString()}] - Error authenticating ${socket.id} for ${options.form.channel_name}`);
                    console.error(error);
                }

                reject({ reason: 'Error sending authentication request.', status: 0 });
            })
        ;
    });
};

/**
 * Check if the incoming socket connection is a private channel.
 *
 * @param  {string} channel
 * @return {boolean}
 */
let isPrivate = function(channel){
    let isPrivate = false;

    _privateChannels.forEach(privateChannel => {
        let regex = new RegExp(privateChannel.replace('\*', '.*'));
        if (regex.test(channel)) isPrivate = true;
    });

    return isPrivate;
};

let isPresence = function (channel) {
    return channel.lastIndexOf('presence-', 0) === 0;
};


/**
 * Check if client is a client event
 *
 * @param  {string} event
 * @return {boolean}
 */
let isClientEvent = function(event){
    let isClientEvent = false;

    _clientEvents.forEach(clientEvent => {
        let regex = new RegExp(clientEvent.replace('\*', '.*'));
        if (regex.test(event)) isClientEvent = true;
    });

    return isClientEvent;
};

let prepareHeaders = function(socket, options) {
    let cookieVal = options.headers['Cookie'] || socket.request.headers.cookie;
    if(cookieVal){
        options.headers['Cookie'] = cookieVal;
    }
    options.headers['X-Requested-With'] = 'XMLHttpRequest';
    options.headers['X-Socket-ID'] = socket.id;

    return options.headers;
};

let prepareForm = function(socket, options) {
    return options.form || {};
};


agServer.setMiddleware(agServer.MIDDLEWARE_INBOUND, async (middlewareStream) => {
  for await (let action of middlewareStream){
    console.log(action.type);

    if(action.type === action.SUBSCRIBE){
        if(typeof action.data === typeof undefined){
            let error = new Error(
                'Data required when subscribing for authorization purposes'
            );
            error.name = 'InvalidActionError';
            action.block(error);
            continue;
        }
        let csrf_name;
        let csrf_token;

        let send_headers_object;

        if(typeof action.data.auth !== typeof undefined && typeof action.data.auth.headers !== typeof undefined){
            csrf_name = action.data.auth.headers['CSRF-TOKEN-NAME'] || 'csrf_token';
            csrf_token = action.data.auth.headers['X-CSRF-TOKEN'] || '';
            send_headers_object = action.data.auth.headers;
        }else{
            csrf_name = 'csrf_token';
            csrf_token = '';
            send_headers_object = {};
        }

        let _options = {
            form: {
                channel_name: action.data.channel
            },
            headers: send_headers_object,
            url:  action.data.auth.url
        };

        // support for sending token via only forms
        _options.form[csrf_name] = csrf_token;

        serverRequest(action.socket, _options).then((res) => {
            //console.log('res: ', res);
            console.log("successfully subscribed to "+action.data.channel);

            if(isPresence(action.data.channel)){
                let member = res.channel_data;
                console.log("joining the channel: "+action.data.channel+" is "+member.user_info.name);
                //_this.presence.join(socket, data.channel, member);
                let eventData =  {
                    event: 'presence:joining',
                    data: member
                };
                //console.log(eventData);
                setTimeout(function(){
                    agServer.exchange.transmitPublish(action.data.channel, eventData);
                }, 1);
            }
            action.allow(); //allow
        }, (error) => {
            console.error(error.reason);
            let error1 = new Error(
                error.reason
            );
            error1.name = 'InvalidActionError';
            action.block(error1);
        });
    }else{
        action.allow();
    }

  }
});


// SocketCluster/WebSocket connection handling loop.
(async () => {
  for await (let {socket} of agServer.listener('connection')) {

    // Handle socket connection.
      (async () => {
        for await (let data of socket.receiver('client event')) {
            clientEvent(socket, data);
        }
      })();
  }
})();

httpServer.listen(SOCKETCLUSTER_PORT);

if (SOCKETCLUSTER_LOG_LEVEL >= 1) {
  (async () => {
    for await (let {error} of agServer.listener('error')) {
      console.error(error);
    }
  })();
}

if (SOCKETCLUSTER_LOG_LEVEL >= 2) {
  console.log(
    `   ${colorText('[Active]', 32)} SocketCluster worker with PID ${process.pid} is listening on port ${SOCKETCLUSTER_PORT}`
  );

  (async () => {
    for await (let {warning} of agServer.listener('warning')) {
      console.warn(warning);
    }
  })();
}

function colorText(message, color) {
  if (color) {
    return `\x1b[${color}m${message}\x1b[0m`;
  }
  return message;
}

if (SCC_STATE_SERVER_HOST) {
  // Setup broker client to connect to SCC.
  let sccClient = sccBrokerClient.attach(agServer.brokerEngine, {
    instanceId: SCC_INSTANCE_ID,
    instancePort: SOCKETCLUSTER_PORT,
    instanceIp: SCC_INSTANCE_IP,
    instanceIpFamily: SCC_INSTANCE_IP_FAMILY,
    pubSubBatchDuration: SCC_PUB_SUB_BATCH_DURATION,
    stateServerHost: SCC_STATE_SERVER_HOST,
    stateServerPort: SCC_STATE_SERVER_PORT,
    mappingEngine: SCC_MAPPING_ENGINE,
    clientPoolSize: SCC_CLIENT_POOL_SIZE,
    authKey: SCC_AUTH_KEY,
    stateServerConnectTimeout: SCC_STATE_SERVER_CONNECT_TIMEOUT,
    stateServerAckTimeout: SCC_STATE_SERVER_ACK_TIMEOUT,
    stateServerReconnectRandomness: SCC_STATE_SERVER_RECONNECT_RANDOMNESS,
    brokerRetryDelay: SCC_BROKER_RETRY_DELAY
  });

  if (SOCKETCLUSTER_LOG_LEVEL >= 1) {
    (async () => {
      for await (let {error} of sccClient.listener('error')) {
        error.name = 'SCCError';
        console.error(error);
      }
    })();
  }
}
