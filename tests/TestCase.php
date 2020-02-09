<?php

namespace EchoSocketCluster\Tests;

use PHPUnit\Framework\TestCase as TestCaseBase;


class TestCase extends TestCaseBase
{
    public function tearDown()
    {
        parent::tearDown();

        \Mockery::close();
    }

    /**
     * Make sure expectException always exists, even on PHPUnit 4
     * @param string      $exception
     * @param string|null $message
     */
    public function expectException($exception, $message = null)
    {
        if (method_exists($this, 'setExpectedException')) {
            $this->setExpectedException($exception, $message);
        } else {
            parent::expectException($exception);
            if (null !== $message) {
                $this->expectExceptionMessage($message);
            }
        }
    }
}