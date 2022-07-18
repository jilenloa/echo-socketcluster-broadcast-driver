Laravel Broadcast Driver for Echo SocketCluster Server
=======================

[![Build Status](https://img.shields.io/travis/jilenloa/echo-socketcluster-broadcast-driver.svg?style=flat-square)](https://travis-ci.org/jilenloa/echo-socketcluster-broadcast-driver)
[![Total Downloads](https://img.shields.io/packagist/dt/jilenloa/echo-socketcluster-broadcast-driver.svg?style=flat-square)](https://packagist.org/packages/jilenloa/echo-socketcluster-broadcast-driver)

It's supported on PHP 7.1+, Laravel 5.8+

Before you can use this library, you first need to setup a server "echo-socketcluster-server". It works similarly to the default "laravel-echo-server". However, it is installed with you run the vendor:publish command. Find that below.
```
php artisan vendor:publish --tag=echosocketcluster

```


Echo Compatible Server using SocketCluster
---------
The echo-socketcluster-server package is created using SocketCluster and it's part of this repo and you can copy it to any folder of your choice. It comes with its own package.json, so you would need to run the npm install command inside the folder afterwards.

For more information on SocketCluster, visit https://socketcluster.io/.

Laravel Installation
----
Install package using Composer
```bash
composer require jilenloa/echo-socketcluster-broadcast-driver:dev-master
```

Add below to your broadcasting.php file.

```php
'echosocketcluster' => [
    'driver' => 'echosocketcluster',
],
```

Add this configuration to your .env file. Update the current setting for BROADCAST_DRIVER to the one below

```dotenv
BROADCAST_DRIVER=echosocketcluster #"redis" is also compatible with this broadcast server just like the default laravel-echo

ECHO_SC_HOST=localhost:8001
ECHO_SC_TOKEN=echo-server-token
REDIS_KEY_PREFIX=laravel_ # just like you would set in laravel-echo-server.json
SOCKETCLUSTER_PORT=8001
SOCKETCLUSTER_WS_ENGINE=uws # defaule engine is "ws"
SOCKETCLUSTER_HTTP_TOKEN=echo-server-token
```

If you have not done this, you can publish the configuration and echo-socketcluster-server files using the command:

```bash
php artisan vendor:publish --tag=echosocketcluster
```


You can then later update the package later using composer:

 ```bash
composer update
 ```

Laravel Echo Client
-----------


```bash
npm install laravel-echo
npm install laravel-echo-connector-socketcluster
```

Below is a sample use of the Laravel Echo client.

```javascript
import Echo from "laravel-echo";
import SocketClusterConnector from "laravel-echo-connector-socketcluster";
window.socketClusterClient = require('./socketcluster-client');

let echo = new Echo({
    client: socketClusterClient,
    broadcaster: SocketClusterConnector,
      auth: {
        headers: {
            //add custom headers here, useful for JWT authentication
        },
        hostname: 'localhost:8001', //laravel host to authorize channels. this is sometimes optional
      },
      socketcluster: {
            hostname: 'localhost',
            port: 8001
        }
    });
```

For more information on laravel-echo visit https://laravel.com/docs/broadcasting.

**Finally**

- Before testing, ensure that you have started the echo-socketcluster-server.


If you experience any challenge, don't hesitate to submit an issue [here](https://github.com/jilenloa/echo-socketcluster-broadcast-driver/issues). 

