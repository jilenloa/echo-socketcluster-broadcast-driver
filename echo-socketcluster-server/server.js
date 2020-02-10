const http = require('http');
const eetase = require('eetase');
const socketClusterServer = require('socketcluster-server');
const express = require('express');
const serveStatic = require('serve-static');
const path = require('path');
const morgan = require('morgan');
const uuid = require('uuid');
const sccBrokerClient = require('scc-broker-client');
const request = require('simple-json-request');


const ENVIRONMENT = process.env.ENV || 'dev';
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

let agOptions = {};

// SOCKETCLUSTER_OPTIONS='{"protocolVersion": 1,"path": "/socketcluster/"}'

if (process.env.SOCKETCLUSTER_OPTIONS) {
  let envOptions = JSON.parse(process.env.SOCKETCLUSTER_OPTIONS);
  Object.assign(agOptions, envOptions);
}

let httpServer = eetase(http.createServer());
let agServer = socketClusterServer.attach(httpServer, agOptions);

let expressApp = express();
if (ENVIRONMENT === 'dev') {
  // Log every HTTP request. See https://github.com/expressjs/morgan for other
  // available formats.
  expressApp.use(morgan('dev'));
}
expressApp.use(serveStatic(path.resolve(__dirname, 'public')));

// Add GET /health-check express route
expressApp.get('/health-check', (req, res) => {
  res.status(200).send('OK');
});

expressApp.post('/api/publish', function(req, res){
    let body = "";
    req.on('data', function(chunk) {
        body += chunk;
    });
    req.on('end', function() {
        console.log(body);
        let json;
        try{
            json = JSON.parse(body.trim());
            console.log(json);
            agServer.exchange.transmitPublish(json.channel, json.data);
            res.send('published message: '+body+' and delivered to channel: '+json.channel);
        }catch (e) {
            console.error('Error publishing message');
            res.send('failed publishing message: '+e.message);
        }

    });

});

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

        console.log("Requesting url: "+options.url);
        //console.log(options);

        //console.info(options)
        request.post(options)
            .then(body => {

                if(typeof body === "string" && body.indexOf("{") === 0){
                    body = JSON.parse(body);
                }

                if (ENVIRONMENT === 'dev') {
                    if(options.form.channel_name){
                        console.info(`[${new Date().toLocaleTimeString()}] - ${socket.id} authenticated for: ${options.form.channel_name}`);
                    }
                }
                resolve(body);
            })
            .catch(error => {
                if (ENVIRONMENT === 'dev') {
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

    console.log(options);

    return options.headers;
};

let prepareForm = function(socket, options) {
    return options.form || {};
};


agServer.setMiddleware(agServer.MIDDLEWARE_INBOUND, async (middlewareStream) => {
  for await (let action of middlewareStream){
    console.log(action.type);

    console.log(action);
    console.log(action.data);

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

        console.log('send_headers');
        console.log(send_headers_object);
        console.log();

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
            /*
            //try to get the user information for authentication
            let _options_info = {
                data: {},
                headers: req.data.auth.headers,
                url:  req.data.auth.url.replace('/broadcasting/auth', '/api/user')
            };
            // support for sending token via only forms
            _options_info.data[csrf_name] = csrf_token;

            serverRequest(req.socket, _options_info).
                then(body => {
                    console.log(body);

                }, error => {
                    console.log(error.reason);
                });
                */

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
