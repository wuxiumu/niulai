<?php
/**
 * includes/seo.php —— 站点 SEO / GEO 公共头片段
 *
 * 用法（在 <head> 内）：
 *   $seo = [
 *     'title' => '...',
 *     'description' => '...',
 *     'keywords' => '...',
 *     'path' => '/',           // 规范路径，用于 canonical
 *     'type' => 'website',    // og:type
 *     'robots' => 'index,follow',
 *   ];
 *   require __DIR__ . '/includes/seo.php';  // 或相对路径
 *
 * 面向：百度 / 搜狗 / 360 / 神马 + 通用搜索 + 微信分享卡片
 */

if (!isset($seo) || !is_array($seo)) $seo = [];

$seoTitle = $seo['title'] ?? '牛来运转 - 放置养牛股市模拟小游戏';
$seoDesc  = $seo['description'] ?? '牛来运转是一款限时搏杀型股市模拟休闲游戏：养牛攒运值、杠杆炒股、机会窗口、冲排行榜，支持好友 PK 与战绩分享。';
$seoKeys  = $seo['keywords'] ?? '牛来运转,股市模拟,放置游戏,养牛游戏,杠杆炒股,排行榜,休闲小游戏,牛市,K线';
$seoPath  = $seo['path'] ?? '/';
$seoType  = $seo['type'] ?? 'website';
$seoRobots= $seo['robots'] ?? 'index,follow';
$seoImage = $seo['image'] ?? '/static/img/logo-512.png';

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
$base   = $scheme . '://' . $host;
$canonical = $base . ($seoPath === '' ? '/' : $seoPath);
$imgAbs = (strpos($seoImage, 'http') === 0) ? $seoImage : ($base . $seoImage);

// 可选：百度站长验证码（部署后在百度搜索资源平台获取，填到下方或环境变量）
$baiduVerify = getenv('BAIDU_SITE_VERIFY') ?: ($seo['baidu_verify'] ?? '');
$googleVerify = getenv('GOOGLE_SITE_VERIFY') ?: ($seo['google_verify'] ?? '');
$sogouVerify = getenv('SOGOU_SITE_VERIFY') ?: ($seo['sogou_verify'] ?? '');
$qihoo360Verify = getenv('QIHOO360_SITE_VERIFY') ?: ($seo['qihoo360_verify'] ?? '');
?>
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= htmlspecialchars($seoTitle, ENT_QUOTES, 'UTF-8') ?></title>
<meta name="description" content="<?= htmlspecialchars($seoDesc, ENT_QUOTES, 'UTF-8') ?>">
<meta name="keywords" content="<?= htmlspecialchars($seoKeys, ENT_QUOTES, 'UTF-8') ?>">
<meta name="author" content="牛来运转">
<meta name="robots" content="<?= htmlspecialchars($seoRobots, ENT_QUOTES, 'UTF-8') ?>">
<meta name="renderer" content="webkit">
<meta name="force-rendering" content="webkit">
<meta name="format-detection" content="telephone=no,email=no,address=no">

<!-- GEO：面向中国大陆用户与国内搜索引擎 -->
<meta name="geo.region" content="CN">
<meta name="geo.placename" content="China">
<meta name="language" content="zh-CN">
<meta http-equiv="content-language" content="zh-CN">
<meta name="applicable-device" content="pc,mobile">
<meta name="MobileOptimized" content="width">
<meta name="HandheldFriendly" content="true">
<meta name="mobile-agent" content="format=html5; url=<?= htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8') ?>">

<link rel="canonical" href="<?= htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8') ?>">
<link rel="alternate" hreflang="zh-CN" href="<?= htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8') ?>">
<link rel="alternate" hreflang="x-default" href="<?= htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8') ?>">

<!-- 图标 / PWA -->
<link rel="icon" href="/static/img/favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/static/img/favicon-16.png" type="image/png" sizes="16x16">
<link rel="icon" href="/static/img/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/static/img/apple-touch-icon.png" sizes="180x180">
<link rel="manifest" href="/static/manifest.json">
<meta name="theme-color" content="#ff2d2d">
<meta name="application-name" content="牛来运转">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="牛来运转">

<!-- Open Graph / 微信 · QQ 分享卡片 -->
<meta property="og:locale" content="zh_CN">
<meta property="og:type" content="<?= htmlspecialchars($seoType, ENT_QUOTES, 'UTF-8') ?>">
<meta property="og:site_name" content="牛来运转">
<meta property="og:title" content="<?= htmlspecialchars($seoTitle, ENT_QUOTES, 'UTF-8') ?>">
<meta property="og:description" content="<?= htmlspecialchars($seoDesc, ENT_QUOTES, 'UTF-8') ?>">
<meta property="og:url" content="<?= htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8') ?>">
<meta property="og:image" content="<?= htmlspecialchars($imgAbs, ENT_QUOTES, 'UTF-8') ?>">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:image:alt" content="牛来运转 Logo">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="<?= htmlspecialchars($seoTitle, ENT_QUOTES, 'UTF-8') ?>">
<meta name="twitter:description" content="<?= htmlspecialchars($seoDesc, ENT_QUOTES, 'UTF-8') ?>">
<meta name="twitter:image" content="<?= htmlspecialchars($imgAbs, ENT_QUOTES, 'UTF-8') ?>">

<?php if ($baiduVerify !== ''): ?>
<meta name="baidu-site-verification" content="<?= htmlspecialchars($baiduVerify, ENT_QUOTES, 'UTF-8') ?>">
<?php endif; ?>
<?php if ($googleVerify !== ''): ?>
<meta name="google-site-verification" content="<?= htmlspecialchars($googleVerify, ENT_QUOTES, 'UTF-8') ?>">
<?php endif; ?>
<?php if ($sogouVerify !== ''): ?>
<meta name="sogou_site_verification" content="<?= htmlspecialchars($sogouVerify, ENT_QUOTES, 'UTF-8') ?>">
<?php endif; ?>
<?php if ($qihoo360Verify !== ''): ?>
<meta name="360-site-verification" content="<?= htmlspecialchars($qihoo360Verify, ENT_QUOTES, 'UTF-8') ?>">
<?php endif; ?>

<script type="application/ld+json">
<?= json_encode([
    '@context' => 'https://schema.org',
    '@graph' => [
        [
            '@type' => 'WebSite',
            '@id' => $base . '/#website',
            'url' => $base . '/',
            'name' => '牛来运转',
            'alternateName' => ['牛来运转小游戏', 'niulai'],
            'description' => '限时搏杀型股市模拟休闲游戏：养牛、杠杆、机会窗口、排行榜与好友 PK。',
            'inLanguage' => 'zh-CN',
            'publisher' => ['@id' => $base . '/#org'],
        ],
        [
            '@type' => 'Organization',
            '@id' => $base . '/#org',
            'name' => '牛来运转',
            'url' => $base . '/',
            'logo' => [
                '@type' => 'ImageObject',
                'url' => $base . '/static/img/logo-512.png',
                'width' => 512,
                'height' => 512,
            ],
        ],
        [
            '@type' => 'WebApplication',
            '@id' => $base . '/niulai-game.html#app',
            'name' => '牛来运转',
            'url' => $base . '/niulai-game.html',
            'applicationCategory' => 'GameApplication',
            'operatingSystem' => 'Web Browser',
            'inLanguage' => 'zh-CN',
            'description' => $seoDesc,
            'image' => $base . '/static/img/logo-512.png',
            'offers' => [
                '@type' => 'Offer',
                'price' => '0',
                'priceCurrency' => 'CNY',
            ],
        ],
        [
            '@type' => 'WebPage',
            '@id' => $canonical . '#webpage',
            'url' => $canonical,
            'name' => $seoTitle,
            'description' => $seoDesc,
            'isPartOf' => ['@id' => $base . '/#website'],
            'inLanguage' => 'zh-CN',
            'primaryImageOfPage' => [
                '@type' => 'ImageObject',
                'url' => $imgAbs,
            ],
        ],
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) ?>
</script>
