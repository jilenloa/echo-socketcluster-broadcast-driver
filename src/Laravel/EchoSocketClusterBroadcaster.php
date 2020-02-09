<?php

namespace EchoSocketCluster\Laravel;

use Illuminate\Broadcasting\Broadcasters\UsePusherChannelConventions;
use Illuminate\Support\Arr;
use GuzzleHttp\Client;
use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Created by PhpStorm.
 * User: jimmy
 * Date: 2/17/19
 * Time: 11:12 PM
 */

class EchoSocketClusterBroadcaster extends Broadcaster
{
    use UsePusherChannelConventions;

    /**
     * Construct
     *
     * @param void
     */
    public function __construct()
    {

    }

    /**
     * Broadcast
     *
     * @param array  $channels
     * @param string $event
     * @param array  $payload
     *
     * @return void
     */
    public function broadcast(array $channels, $event, array $payload = array())
    {
        $payload = [
            'event' => $event,
            'data' => $payload,
            'socket' => Arr::pull($payload, 'socket'),
        ];

        foreach ($channels as $channel) {
            $this->publish((string)$channel, $payload);
        }
    }

    public function publish($channel, $body){
        $client = new Client();
        try{
            $broadcast_host = "http://".config('echo-sc.broadcast_host')."/api/publish";
            if(config('echo-sc.secure')){
                $broadcast_host = "https://".config('echo-sc.broadcast_host')."/api/publish";
            }
            $client->request("POST", $broadcast_host, [
                'json' => [
                    'channel' => $channel,
                    'data' => $body,
                    'token' => config('echo-sc.user_token')
                ]
            ]);
        }catch (\GuzzleHttp\Exception\ConnectException $connectException){
            if(function_exists('logger')){
                logger()->error('unable to connect to echosocketcluster server');
            }
        }
    }

    /**
     * Authenticate the incoming request for a given channel.
     *
     * @param  \Illuminate\Http\Request $request
     * @return mixed
     */
    public function auth($request)
    {
        $channelName = $this->normalizeChannelName($request->channel_name);

        if ($this->isGuardedChannel($request->channel_name) &&
            ! $this->retrieveUser($request, $channelName)) {
            throw new AccessDeniedHttpException;
        }

        return parent::verifyUserCanAccessChannel(
            $request, $channelName
        );
    }

    /**
     * Return the valid authentication response.
     *
     * @param  \Illuminate\Http\Request $request
     * @param  mixed $result
     * @return mixed
     */
    public function validAuthenticationResponse($request, $result)
    {
        if (is_bool($result)) {
            return json_encode($result);
        }

        $channelName = $this->normalizeChannelName($request->channel_name);

        return json_encode(['channel_data' => [
            'user_id' => $this->retrieveUser($request, $channelName)->getAuthIdentifier(),
            'user_info' => $result,
        ]]);
    }
}
