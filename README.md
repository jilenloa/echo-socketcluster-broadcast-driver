Laravel Broadcast Driver for Echo SocketCluster Server
=======================

[![Build Status](https://img.shields.io/travis/jilenloa/echo-socketcluster-broadcast-driver.svg?style=flat-square)](https://travis-ci.org/jilenloa/echo-socketcluster-broadcast-driver)
[![Total Downloads](https://img.shields.io/packagist/dt/jilenloa/echo-socketcluster-broadcast-driver.svg?style=flat-square)](https://packagist.org/packages/jilenloa/echo-socketcluster-broadcast-driver)

It's supported on PHP 7.1+, Laravel 5.8+

Before you can use this library, you first need to setup a server "echo-socketcluster-server". It works similarly to the default "laravel-echo-server".

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

After updating composer, add the service provider to the providers array in config/app.php. 

**Note**: You must add this service provider just before the App\Providers\BroadcastServiceProvider::class

```php
EchoSocketCluster\Providers\EchoSocketClusterServiceProvider::class,
App\Providers\BroadcastServiceProvider::class,
```

Add below to your broadcasting.php file.

```php
'echosocketcluster' => [
    'driver' => 'echosocketcluster',
],
```

Add this configuration to your .env file. Update the current setting for BROADCAST_DRIVER to the one below

```dotenv
BROADCAST_DRIVER=echosocketcluster

ECHO_SC_HOST=localhost:8001
ECHO_SC_TOKEN=echo-server-token
```

Optionally, you can publish the configuration file using the command:

```bash
php artisan vendor:publish --tag=echosocketcluster
```

You can then later update the package later using composer:

 ```bash
composer update
 ```
