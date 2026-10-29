<?php
declare(strict_types=1);
if (!defined('RLS_STATS_BOOTSTRAP')) {
    http_response_code(404);
    exit;
}

const RLS_STATS_GUARD = "<?php http_response_code(404); exit; __halt_compiler();\n";
const RLS_STATS_MARKER = "\n=== RLS_STATS_STATE_V1: НЕ РЕДАКТИРОВАТЬ ===\n";

function rls_stats_products(): array
{
    return [
        'kit' => 'Футбольная форма',
        'suit' => 'Парадный костюм',
        'training' => 'Тренировочный костюм',
        'windbreaker' => 'Ветровка',
        'winter' => 'Зимняя куртка',
    ];
}

function rls_stats_validate(array $state, DateTimeZone $zone): void
{
    if (($state['version'] ?? null) !== 1 || !is_array($state['days'] ?? null)
        || !is_array($state['recent'] ?? null) || !is_string($state['started_at'] ?? null)
        || !array_key_exists('last_download_at', $state)) {
        throw new RuntimeException('Invalid statistics file; original preserved.');
    }
    new DateTimeImmutable($state['started_at'], $zone);
    if ($state['last_download_at'] !== null) {
        new DateTimeImmutable($state['last_download_at'], $zone);
    }
    $products = rls_stats_products();
    foreach ($state['days'] as $day => $counts) {
        $parsed = is_string($day) ? DateTimeImmutable::createFromFormat('!Y-m-d', $day, $zone) : false;
        if (!$parsed || $parsed->format('Y-m-d') !== $day || !is_array($counts)) {
            throw new RuntimeException('Invalid daily statistics; original preserved.');
        }
        foreach ($counts as $product => $count) {
            if (!isset($products[$product]) || !is_int($count) || $count < 0) {
                throw new RuntimeException('Invalid download count; original preserved.');
            }
        }
    }
    foreach ($state['recent'] as $id => $timestamp) {
        if (!preg_match('/^[a-f0-9]{32}$/D', (string)$id) || !is_int($timestamp)) {
            throw new RuntimeException('Invalid event history; original preserved.');
        }
    }
}

function rls_stats_read(string $path, DateTimeImmutable $now): array
{
    if (!file_exists($path)) {
        return ['version' => 1, 'started_at' => $now->format(DATE_ATOM),
            'last_download_at' => null, 'days' => [], 'recent' => []];
    }
    $contents = @file_get_contents($path);
    if ($contents === false || !str_starts_with($contents, RLS_STATS_GUARD)) {
        throw new RuntimeException('Unreadable statistics file; original preserved.');
    }
    $position = strpos($contents, RLS_STATS_MARKER);
    if ($position === false) {
        throw new RuntimeException('Statistics data missing; original preserved.');
    }
    $state = json_decode(substr($contents, $position + strlen(RLS_STATS_MARKER)), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($state)) {
        throw new RuntimeException('Invalid statistics state; original preserved.');
    }
    rls_stats_validate($state, $now->getTimezone());
    return $state;
}

function rls_stats_summary(array $state, DateTimeImmutable $now): array
{
    $zone = $now->getTimezone();
    $weekStart = $now->setISODate((int)$now->format('o'), (int)$now->format('W'), 1)->setTime(0, 0);
    $summary = ['total' => 0, 'today' => 0, 'week' => 0, 'month' => 0,
        'products' => array_fill_keys(array_keys(rls_stats_products()), 0), 'months' => [], 'weeks' => []];
    foreach ($state['days'] as $day => $counts) {
        $count = array_sum($counts);
        $summary['total'] += $count;
        foreach ($counts as $product => $number) {
            $summary['products'][$product] += $number;
        }
        $month = substr($day, 0, 7);
        $date = new DateTimeImmutable($day, $zone);
        $week = $date->format('o-\WW');
        $summary['months'][$month] = ($summary['months'][$month] ?? 0) + $count;
        $summary['weeks'][$week] = ($summary['weeks'][$week] ?? 0) + $count;
        if ($day === $now->format('Y-m-d')) {
            $summary['today'] += $count;
        }
        if ($day >= $weekStart->format('Y-m-d') && $day <= $now->format('Y-m-d')) {
            $summary['week'] += $count;
        }
        if ($month === $now->format('Y-m')) {
            $summary['month'] += $count;
        }
    }
    return $summary;
}

function rls_stats_report(array $state, DateTimeImmutable $now): string
{
    $summary = rls_stats_summary($state, $now);
    $zone = $now->getTimezone();
    $start = (new DateTimeImmutable($state['started_at']))->setTimezone($zone)->setTime(0, 0);
    $weekStart = $now->setISODate((int)$now->format('o'), (int)$now->format('W'), 1)->setTime(0, 0);
    $last = $state['last_download_at'] === null ? 'ещё не было' :
        (new DateTimeImmutable($state['last_download_at']))->setTimezone($zone)->format('d.m.Y H:i:s');
    $lines = [
        'RLS — СТАТИСТИКА СКАЧИВАНИЙ МАКЕТОВ',
        'Сводка сформирована: ' . $now->format('d.m.Y H:i:s P') . ' (' . $zone->getName() . ')',
        'Начало учёта: ' . $start->format('d.m.Y'),
        'Последнее скачивание: ' . $last,
        '',
        'ВСЕГО ЗА ВСЁ ВРЕМЯ: ' . $summary['total'],
        'За день ' . $now->format('d.m.Y') . ': ' . $summary['today'],
        'За неделю ' . $weekStart->format('d.m.Y') . ' — ' . $weekStart->modify('+6 days')->format('d.m.Y') . ': ' . $summary['week'],
        'За месяц ' . $now->format('01.m.Y') . ' — ' . $now->format('t.m.Y') . ': ' . $summary['month'],
        '', 'ПО ВИДАМ ЭКИПИРОВКИ (за всё время)',
    ];
    foreach (rls_stats_products() as $product => $name) {
        $lines[] = $name . ': ' . $summary['products'][$product];
    }
    $lines[] = ''; $lines[] = 'ПО КАЛЕНДАРНЫМ МЕСЯЦАМ';
    for ($date = $start->modify('first day of this month'); $date <= $now; $date = $date->modify('+1 month')) {
        $lines[] = $date->format('Y-m') . ' (' . $date->format('01.m.Y') . ' — ' . $date->format('t.m.Y') . '): ' . ($summary['months'][$date->format('Y-m')] ?? 0);
    }
    $lines[] = ''; $lines[] = 'ПО КАЛЕНДАРНЫМ НЕДЕЛЯМ (понедельник — воскресенье)';
    $firstWeek = $start->setISODate((int)$start->format('o'), (int)$start->format('W'), 1);
    for ($date = $firstWeek; $date <= $now; $date = $date->modify('+1 week')) {
        $lines[] = $date->format('o-\WW') . ' (' . $date->format('d.m.Y') . ' — ' . $date->modify('+6 days')->format('d.m.Y') . '): ' . ($summary['weeks'][$date->format('o-\WW')] ?? 0);
    }
    $lines[] = ''; $lines[] = 'ПО ДНЯМ';
    for ($date = $start; $date <= $now; $date = $date->modify('+1 day')) {
        $counts = $state['days'][$date->format('Y-m-d')] ?? [];
        $parts = [];
        foreach (rls_stats_products() as $product => $name) {
            if (!empty($counts[$product])) {
                $parts[] = $name . ': ' . $counts[$product];
            }
        }
        $lines[] = $date->format('d.m.Y') . ': ' . array_sum($counts) . ($parts ? ' | ' . implode('; ', $parts) : '');
    }
    $lines[] = '';
    $lines[] = 'Сводка обновляется после скачивания или команды --refresh. Дата сводки указана сверху.';
    $lines[] = 'Один подготовленный PNG, переданный браузеру на скачивание, — одно событие.';
    $lines[] = 'Повторное сохранение того же PNG из модального окна не считается повторно.';
    return implode("\n", $lines) . "\n";
}

function rls_stats_write(string $path, string $contents): void
{
    $temporary = dirname($path) . '/.write-' . bin2hex(random_bytes(12)) . '.php';
    $handle = @fopen($temporary, 'xb');
    if ($handle === false) {
        throw new RuntimeException('Cannot create statistics file.');
    }
    @chmod($temporary, 0600);
    try {
        $offset = 0;
        $length = strlen($contents);
        while ($offset < $length) {
            $written = fwrite($handle, substr($contents, $offset));
            if ($written === false || $written === 0) {
                throw new RuntimeException('Cannot write statistics file.');
            }
            $offset += $written;
        }
        if (!fflush($handle) || (function_exists('fsync') && !fsync($handle))) {
            throw new RuntimeException('Cannot flush statistics file.');
        }
        fclose($handle); $handle = null;
        if (!@rename($temporary, $path)) {
            throw new RuntimeException('Cannot publish statistics file.');
        }
    } finally {
        if (is_resource($handle)) { fclose($handle); }
        if (file_exists($temporary)) { @unlink($temporary); }
    }
}

function rls_stats_update(array $config, ?array $event, ?DateTimeImmutable $now = null): array
{
    $zone = new DateTimeZone($config['timezone']);
    $now = ($now ?? new DateTimeImmutable('now', $zone))->setTimezone($zone);
    if ($event !== null && (!is_string($event['event_id'] ?? null)
        || !preg_match('/^[a-f0-9]{32}$/D', $event['event_id'])
        || !isset(rls_stats_products()[$event['product'] ?? '']))) {
        throw new InvalidArgumentException('Invalid download event.');
    }
    $directory = rtrim($config['directory'], '/');
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Cannot create statistics directory.');
    }
    $lock = @fopen($directory . '/.write.lock', 'c+b');
    if ($lock === false) { throw new RuntimeException('Cannot open statistics lock.'); }
    @chmod($directory . '/.write.lock', 0600);
    try {
        $deadline = microtime(true) + 5;
        while (!flock($lock, LOCK_EX | LOCK_NB)) {
            if (microtime(true) >= $deadline) { throw new RuntimeException('Statistics lock timeout.'); }
            usleep(10000);
        }
        $path = $directory . '/downloads.log.php';
        $state = rls_stats_read($path, $now);
        foreach ($state['recent'] as $id => $timestamp) {
            if ($timestamp < $now->getTimestamp() - 7 * 86400) { unset($state['recent'][$id]); }
        }
        if ($event !== null && !isset($state['recent'][$event['event_id']])) {
            $day = $now->format('Y-m-d');
            $product = $event['product'];
            $state['days'][$day][$product] = ($state['days'][$day][$product] ?? 0) + 1;
            $state['recent'][$event['event_id']] = $now->getTimestamp();
            $state['last_download_at'] = $now->format(DATE_ATOM);
        }
        ksort($state['days']);
        $state['updated_at'] = $now->format(DATE_ATOM);
        $contents = RLS_STATS_GUARD . rls_stats_report($state, $now) . RLS_STATS_MARKER .
            json_encode($state, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
        rls_stats_write($path, $contents);
        return $state;
    } finally {
        flock($lock, LOCK_UN); fclose($lock);
    }
}
