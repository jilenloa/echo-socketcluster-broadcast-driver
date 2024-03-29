<?php
/**
 * Created by PhpStorm.
 * User: macbookpro
 * Date: 2/8/20
 * Time: 5:56 AM
 */

namespace EchoSocketCluster\Providers;


use EchoSocketCluster\Laravel\EchoSocketClusterBroadcaster;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Support\ServiceProvider as BaseServiceProvider;


class EchoSocketClusterServiceProvider extends BaseServiceProvider
{
    /**
     * @throws \Illuminate\Contracts\Container\BindingResolutionException
     */
    public function boot(){
        $this->app->make(BroadcastManager::class)->extend('echosocketcluster', function ($app) {
            return new EchoSocketClusterBroadcaster();
        });
    }

    /**
     * Register the service provider.
     *
     * @return void
     */
    public function register()
    {
        $configPath = __DIR__ . '/../../config/echo-sc.php';
        $jsPath = __DIR__ . '/../../echo-socketcluster-server';
        $jsPath2 = __DIR__ . '/../../echo-socketcluster-server/public/socketcluster-client.js';
        $jsPath3 = __DIR__ . '/../../resources/js';
        if (function_exists('config_path')) {
            $publishPath = config_path('echo-sc.php');
        } else {
            $publishPath = base_path('config/echo-sc.php');
        }
        $this->publishes([
            $configPath => $publishPath,
            $jsPath => base_path('echo-socketcluster-server'),
            $jsPath2 => base_path('public/js/socketcluster-client.js'),
            $jsPath3 => base_path('resources/js'),
            ], 'echosocketcluster');

        $this->mergeConfigFrom($configPath, 'echo-sc');
    }
}