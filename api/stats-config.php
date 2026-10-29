<?php
declare(strict_types=1);
if (!defined('RLS_STATS_BOOTSTRAP')) {
    http_response_code(404);
    exit;
}

return [
    'timezone' => 'Europe/Moscow',
    // You may change this to an absolute writable directory OUTSIDE the website.
    'directory' => dirname(__DIR__) . '/private-stats',
    // Normally the request host is checked automatically. If using a proxy,
    // list the exact public origins here, e.g. ['https://kit-rls.ru'].
    'allowed_origins' => [],
];
