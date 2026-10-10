<?php
/**
 * sitemap.php —— 动态站点地图（按当前域名生成绝对 URL）
 * 供百度 / 搜狗 / 360 / 谷歌等读取：robots.txt 已声明 Sitemap: /sitemap.php
 */
header('Content-Type: application/xml; charset=utf-8');
header('X-Robots-Tag: noindex'); // 地图本身不必进索引

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
$base   = $scheme . '://' . $host;
$today  = date('Y-m-d');

$urls = [
    ['loc' => '/',                 'prio' => '1.0', 'freq' => 'daily',   'last' => $today],
    ['loc' => '/niulai-game.html', 'prio' => '0.9', 'freq' => 'weekly',  'last' => $today],
    ['loc' => '/leaderboard.html', 'prio' => '0.8', 'freq' => 'hourly',  'last' => $today],
    ['loc' => '/pk-result.html',   'prio' => '0.5', 'freq' => 'weekly',  'last' => $today],
];

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:mobile="http://www.baidu.com/schemas/sitemap-mobile/1/">
<?php foreach ($urls as $u): ?>
  <url>
    <loc><?= htmlspecialchars($base . $u['loc'], ENT_XML1) ?></loc>
    <lastmod><?= $u['last'] ?></lastmod>
    <changefreq><?= $u['freq'] ?></changefreq>
    <priority><?= $u['prio'] ?></priority>
    <mobile:mobile type="pc,mobile"/>
  </url>
<?php endforeach; ?>
</urlset>
