<?php
declare(strict_types=1);
ini_set('display_errors', '0');
define('RLS_STATS_BOOTSTRAP', true);
require __DIR__ . '/stats-store.php';
$config = require __DIR__ . '/stats-config.php';

if (PHP_SAPI === 'cli') {
    if (($argv[1] ?? '') !== '--refresh') { exit(64); }
    try { rls_stats_update($config, null); exit(0); }
    catch (Throwable $error) { error_log('RLS statistics: ' . $error->getMessage()); exit(1); }
}

header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
// There is deliberately no HTTP report endpoint, GET API or response with totals.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(404); exit; }

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$parts = parse_url($origin);
$host = is_array($parts) ? strtolower(($parts['host'] ?? '') . (isset($parts['port']) ? ':' . $parts['port'] : '')) : '';
$allowed = $config['allowed_origins'];
$sameOrigin = $allowed ? in_array($origin, $allowed, true) :
    ($host !== '' && $host === strtolower($_SERVER['HTTP_HOST'] ?? '') &&
     in_array($parts['scheme'] ?? '', ['http', 'https'], true) && !isset($parts['user']) && !isset($parts['pass']));
$fetchSite = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? 'same-origin';
if (!$sameOrigin || !in_array($fetchSite, ['same-origin', 'none'], true)) {
    http_response_code(403); exit;
}
if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
    http_response_code(415); exit;
}
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1024) { http_response_code(413); exit; }
$body = file_get_contents('php://input', false, null, 0, 1025);
if ($body === false || strlen($body) > 1024) { http_response_code(413); exit; }
try {
    $event = json_decode($body, true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($event) || !is_string($event['event_id'] ?? null)
        || !preg_match('/^[a-f0-9]{32}$/D', $event['event_id'])
        || !is_string($event['product'] ?? null) || !isset(rls_stats_products()[$event['product']])) {
        http_response_code(400); exit;
    }
} catch (JsonException $error) { http_response_code(400); exit; }

try {
    rls_stats_update($config, ['event_id' => $event['event_id'], 'product' => $event['product']]);
    http_response_code(204);
} catch (Throwable $error) {
    // The browser gets no statistics, stack traces, file paths or PHP warnings.
    error_log('RLS statistics: ' . $error->getMessage());
    http_response_code(503);
}
