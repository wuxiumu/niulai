<?php
/**
 * index.php —— 牛来运转·首页（落地页）
 *
 * 一页搞定站点导览：
 *   · 顶部介绍 / 链接到游戏、用户榜、后台
 *   · 中部一个「实时数据预览」卡：调用 api/rank.php 与 api/share.php 展示当前排名 + 分享数
 *   · 底部小提示（PHP / Redis / SQLite 版本信息）
 *
 * 设计原则：
 *   1) 不自动跳转到游戏，避免「想分享落地的链接却直接进了游戏」
 *   2) 入口颜色与排行榜色系保持一致（金 + 红）
 *   3) Redis / SQLite 失败时页面仍可访问，预览区降级提示（不阻塞导览）
 */
require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/db.php';
niulai_cors();

// 简易数据预览（仅用于首页展示；失败不阻塞）
$rankPreview = ['top3' => [], 'total' => 0, 'ok' => false];
$shareStat   = ['byChannel' => [], 'total' => 0, 'pkTotal' => 0, 'ok' => false];
$redisOk     = false;
$sqliteOk    = false;

try {
    $r = niulai_redis();
    if ($r !== null) {
        $redisOk = true;
        // 触发 lazy seed（与 api/rank.php 一致的空榜示例，便于本地预览）
        $sentinel = 'niulai:seed:done';
        if (!$r->exists($sentinel) && (int)$r->zCard(NIULAI_ZSET) === 0) {
            $now = time();
            $demo = [
                ['seed_01','牛魔王',58820,'牛市封神'],['seed_02','华尔街之牛',42150,'牛市封神'],
                ['seed_03','杠杆狂人',38900,'杠杆爆仓'],['seed_04','复利信徒',31200,'主动收手'],
                ['seed_05','佛系养牛',27500,'时间到'],
            ];
            foreach ($demo as $i => $d) {
                $r->hMSet(NIULAI_HASH . $d[0], ['name'=>$d[1],'score'=>$d[2],'reason'=>$d[3],
                    'date'=>date('Y/m/d', $now - 86400*(9-$i)), 'runStart'=>$now-5000, 'runEnd'=>$now-1000, 'createdAt'=>$now-1000*(9-$i)]);
                $r->zAdd(NIULAI_ZSET, $d[2], $d[0]);
            }
            $r->set($sentinel, '1');
        }
        $rankPreview['ok'] = true;
        $rankPreview['total'] = (int)$r->zCard(NIULAI_ZSET);
        $topIds = $r->zRevRange(NIULAI_ZSET, 0, 2);
        if (is_array($topIds)) {
            foreach ($topIds as $rid) {
                $h = $r->hGetAll(NIULAI_HASH . $rid);
                if (!is_array($h) || empty($h)) continue;
                $rankPreview['top3'][] = [
                    'name'   => $h['name'] ?? '牛人',
                    'score'  => floatval($h['score'] ?? 0),
                    'reason' => $h['reason'] ?? '',
                ];
            }
        }
    }
} catch (Exception $e) { /* 安静降级 */ }

try {
    $sd = niulai_db();
    $sqliteOk = true;
    $by = $sd->query("SELECT channel, COUNT(*) AS n FROM share_records GROUP BY channel")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($by as $b) { $shareStat['byChannel'][$b['channel']] = (int)$b['n']; }
    $shareStat['total'] = (int)$sd->query("SELECT COUNT(*) FROM share_records")->fetchColumn();
    $shareStat['pkTotal'] = (int)$sd->query("SELECT COUNT(*) FROM pk_invites")->fetchColumn();
    $shareStat['ok'] = true;
} catch (Exception $e) { /* 安静降级 */ }

function fmt_num($n) { return number_format(intval($n), 0, '.', ','); }

$seo = [
    'title' => '牛来运转 - 官方站｜放置养牛股市模拟小游戏',
    'description' => '牛来运转官方网站：限时搏杀型股市模拟休闲游戏。养牛攒运值、杠杆炒股、机会窗口、冲排行榜，支持好友 PK 与战绩分享。立即开玩。',
    'keywords' => '牛来运转,牛来运转官网,股市模拟,放置游戏,养牛游戏,杠杆炒股,排行榜,好友PK,在线小游戏',
    'path' => '/',
    'type' => 'website',
];
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<?php require __DIR__ . '/includes/seo.php'; ?>
<style>
  :root{
    --gold:#ffd23f; --red:#e23b3b; --bg:#0f1115; --card:#171a21; --line:rgba(255,255,255,.08);
    --dim:#9aa3b2; --main:#f4f6fb; --green:#51d88a; --blue:#5a9bff;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:radial-gradient(1200px 800px at 50% -10%,#1b2030,#0f1115);
    color:var(--main);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;min-height:100vh}
  .wrap{max-width:720px;margin:0 auto;padding:36px 18px 80px}
  .top{text-align:center;margin-bottom:32px}
  .top .logo{width:88px;height:88px;margin:0 auto 12px;border-radius:22px;overflow:hidden;box-shadow:0 8px 32px rgba(255,45,45,.35);border:1px solid rgba(255,210,63,.35)}
  .top .logo img{width:100%;height:100%;display:block;object-fit:cover}
  .top h1{margin:0;font-size:30px;letter-spacing:2px;color:var(--gold);text-shadow:0 0 24px rgba(255,210,63,0.35)}
  .top .slogan{margin-top:6px;color:var(--dim);font-size:14px;letter-spacing:1px}
  .cards{display:grid;gap:14px;margin-top:20px}
  .card{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;
    padding:18px 16px;background:var(--card);border:1px solid var(--line);border-radius:14px;
    text-decoration:none;color:var(--main);transition:transform .15s,border-color .2s,box-shadow .2s}
  .card:hover{transform:translateY(-2px);border-color:rgba(255,210,63,0.4);box-shadow:0 8px 32px rgba(255,210,63,0.15)}
  .card .left{display:flex;align-items:center;gap:14px;min-width:0}
  .card .emo{font-size:34px;line-height:1}
  .card .ct h3{margin:0;font-size:17px;font-weight:700}
  .card .ct p{margin:3px 0 0;color:var(--dim);font-size:13px}
  .card .arrow{color:var(--gold);font-size:22px}
  .card.gold{background:linear-gradient(135deg,rgba(255,210,63,0.18),rgba(255,210,63,0.06));border-color:rgba(255,210,63,0.45)}
  .card.gold h3{color:var(--gold)}

  .preview{margin-top:28px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
  .preview h3{margin:0 0 10px;font-size:14px;color:var(--dim);font-weight:600;text-transform:uppercase;letter-spacing:1.5px}
  .preview .row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed var(--line)}
  .preview .row:last-child{border-bottom:none}
  .preview .left{color:var(--dim);font-size:13px}
  .preview .right{font-weight:700;color:var(--gold)}
  .preview .top3{margin-top:8px}
  .preview .top3 .line{display:flex;justify-content:space-between;padding:8px 0;font-size:14px}
  .preview .top3 .name{font-weight:600}
  .preview .top3 .score{color:#ff6b6b;font-weight:700;font-variant-numeric:tabular-nums}
  .preview .top3 .rank{color:var(--gold);width:24px;font-weight:800}
  .pill{display:inline-block;padding:2px 8px;margin-right:4px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid var(--line);font-size:12px;color:var(--dim)}
  .pill b{color:var(--main);font-weight:700}
  .hint{margin:8px 0 0;padding:10px 12px;border-radius:10px;background:rgba(255,138,61,.12);border:1px solid rgba(255,138,61,.35);color:#ffb074;font-size:13px;line-height:1.5}
  .hint.ok{background:rgba(81,216,138,.08);border-color:rgba(81,216,138,.3);color:var(--green)}

  .stack{margin-top:24px;text-align:center;color:var(--dim);font-size:12px}
  .stack code{background:rgba(255,255,255,.06);padding:1px 6px;border-radius:4px}
  .stack a{color:var(--gold);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">

  <div class="top">
    <div class="logo"><img src="/static/img/logo-512.png" width="88" height="88" alt="牛来运转 Logo"></div>
    <h1>牛来运转</h1>
    <div class="slogan">股市模拟 · 牛熊 K 线 · 牛运亨通</div>
  </div>

  <div class="cards">
    <a class="card gold" href="niulai-game.html">
      <div class="left">
        <div class="emo">🎮</div>
        <div class="ct">
          <h3>开始游戏</h3>
          <p>单人模拟炒股 · 杠杆 · 牛运值 · 牛市封神</p>
        </div>
      </div>
      <div class="arrow">›</div>
    </a>
    <a class="card" href="leaderboard.html">
      <div class="left">
        <div class="emo">🏆</div>
        <div class="ct">
          <h3>牛人榜 · 分享</h3>
          <p>看榜 · 生成挑战邀请 · 海报 / 二维码分享</p>
        </div>
      </div>
      <div class="arrow">›</div>
    </a>
    <a class="card" href="admin/">
      <div class="left">
        <div class="emo">⚙️</div>
        <div class="ct">
          <h3>管理入口</h3>
          <p>排行榜 · 分享记录 · 好友挑战</p>
        </div>
      </div>
      <div class="arrow">›</div>
    </a>
  </div>

  <div class="preview">
    <h3>实时数据</h3>
    <?php if (!$rankPreview['ok']): ?>
    <div class="hint">总榜暂时连不上。游戏照常玩，成绩会先记在你这台设备上；恢复后刷新本页即可看到最新排名。</div>
    <?php else: ?>
    <div class="row"><span class="left">排行榜上榜人数</span><span class="right"><?= fmt_num($rankPreview['total']) ?></span></div>
    <?php if (!empty($rankPreview['top3'])): ?>
    <div class="top3">
      <?php foreach ($rankPreview['top3'] as $i => $t): ?>
      <div class="line">
        <span class="rank"><?= $i+1 ?></span>
        <span class="name"><?= htmlspecialchars($t['name']) ?></span>
        <span class="score"><?= fmt_num($t['score']) ?></span>
      </div>
      <?php endforeach; ?>
    </div>
    <?php elseif ($rankPreview['total'] === 0): ?>
    <div class="hint ok">榜单还是空的，去玩一局再回来看前三名。</div>
    <?php endif; ?>
    <?php endif; ?>

    <?php if (!$shareStat['ok']): ?>
    <div class="hint" style="margin-top:12px">分享与挑战统计暂时看不到，不影响游玩与导览。</div>
    <?php else: ?>
    <div class="row" style="margin-top:6px"><span class="left">分享次数</span><span class="right"><?= fmt_num($shareStat['total']) ?></span></div>
    <div class="row"><span class="left">好友挑战邀请数</span><span class="right"><?= fmt_num($shareStat['pkTotal']) ?></span></div>
    <div class="row" style="border-bottom:none;padding-top:14px">
      <span class="left">分享方式</span>
      <span class="right" style="text-align:right">
        <?php
          $by = $shareStat['byChannel'] ?: [];
          $labels = [
            'system' => '系统分享',
            'qrcode' => '二维码',
            'poster' => '海报',
            'link'   => '链接',
            'copy'   => '复制',
            'other'  => '其他',
          ];
          foreach ($labels as $k => $lab) {
            echo '<span class="pill">'.htmlspecialchars($lab).' <b>'.($by[$k]??0).'</b></span>';
          }
        ?>
      </span>
    </div>
    <?php endif; ?>
  </div>

  <div class="stack">
    <div>
      排行榜 <?= $redisOk ? '畅通' : '暂缓' ?> ·
      分享记录 <?= $sqliteOk ? '畅通' : '暂缓' ?>
    </div>
    <div style="margin-top:6px">
      <a href="niulai-game.html">开始游戏</a> ·
      <a href="leaderboard.html">牛人榜</a> ·
      <a href="admin/">管理入口</a>
    </div>
  </div>

  <?php require __DIR__ . '/includes/site-footer.php'; ?>

</div>
</body>
</html>
