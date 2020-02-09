Laravel Broadcast Driver for Echo SocketCluster Server
=======================

[![Build Status](https://img.shields.io/travis/jilenloa/echo-socketcluster-broadcast-driver.svg?style=flat-square)](https://travis-ci.org/jilenloa/echo-socketcluster-broadcast-driver)
[![Total Downloads](https://img.shields.io/packagist/dt/jilenloa/echo-socketcluster-broadcast-driver.svg?style=flat-square)](https://packagist.org/packages/jilenloa/echo-socketcluster-broadcast-driver)

It's supported on PHP 7.1+, Laravel 5.8+

Before you can use this library, you first need to setup a server "echo-socketcluster-server". It works similarly to the default "laravel-echo-server".

The echo-socketcluster-server package can be installed via npm.

Install package using Composer
```bash
composer require jilenloa/echo-socketcluster-broadcast-driver
```

After updating composer, add the service provider to the providers array in config/app.php

```php
EchoSocketCluster\Providers\EchoSocketClusterServiceProvider
```

Add this configuration to your .env file
```dotenv
ECHO_SC_HOST=localhost:8001
ECHO_SC_TOKEN=echo-server-token
```

You can then later update the package later using composer:

 ```bash
composer update
 ```
