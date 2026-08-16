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
 */
header("Location: /niulai-game.html", true, 302);
exit;

require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/db.php';
niulai_cors();

// 简易数据预览（仅用于首页展示；失败不阻塞）
$rankPreview = ['top3' => [], 'total' => 0];
$shareStat   = ['byChannel' => []];
try {
    $r = niulai_redis();
    if ($r !== null) {
        // 触发 lazy seed
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
} catch (Exception $e) { /* 安静 */ }

try {
    $sd = niulai_db();
    $by = $sd->query("SELECT channel, COUNT(*) AS n FROM share_records GROUP BY channel")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($by as $b) { $shareStat['byChannel'][$b['channel']] = (int)$b['n']; }
    $shareStat['total'] = (int)$sd->query("SELECT COUNT(*) FROM share_records")->fetchColumn();
    $shareStat['pkTotal'] = (int)$sd->query("SELECT COUNT(*) FROM pk_invites")->fetchColumn();
} catch (Exception $e) { /* 安静 */ }

function fmt_num($n) { return number_format(intval($n), 0, '.', ','); }
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>牛来运转 · 主页</title>
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
  .top .logo{font-size:64px;line-height:1;margin-bottom:10px}
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

  .stack{margin-top:24px;text-align:center;color:var(--dim);font-size:12px}
  .stack code{background:rgba(255,255,255,.06);padding:1px 6px;border-radius:4px}
  .stack a{color:var(--gold);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">

  <div class="top">
    <div class="logo">🐂</div>
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
          <p>看榜 · 生成 PK 邀请 · 海报 / 二维码分享</p>
        </div>
      </div>
      <div class="arrow">›</div>
    </a>
    <a class="card" href="api/admin.php">
      <div class="left">
        <div class="emo">⚙️</div>
        <div class="ct">
          <h3>管理后台</h3>
          <p>排行榜 / 分享记录 / PK 邀请 三 tab 管理</p>
        </div>
      </div>
      <div class="arrow">›</div>
    </a>
  </div>

  <div class="preview">
    <h3>实时数据</h3>
    <div class="row"><span class="left">Redis ZSET 排行榜条数</span><span class="right"><?= fmt_num($rankPreview['total']) ?></span></div>
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
    <?php endif; ?>
    <div class="row" style="margin-top:6px"><span class="left">SQLite 分享事件总数</span><span class="right"><?= fmt_num($shareStat['total']) ?></span></div>
    <div class="row"><span class="left">SQLite PK 邀请总数</span><span class="right"><?= fmt_num($shareStat['pkTotal'] ?? 0) ?></span></div>
    <div class="row" style="border-bottom:none;padding-top:14px">
      <span class="left">渠道分布</span>
      <span class="right" style="text-align:right">
        <?php
          $by = $shareStat['byChannel'] ?: [];
          echo '<span class="pill">system <b>'.($by['system']??0).'</b></span>';
          echo '<span class="pill">qrcode <b>'.($by['qrcode']??0).'</b></span>';
          echo '<span class="pill">poster <b>'.($by['poster']??0).'</b></span>';
          echo '<span class="pill">link <b>'.($by['link']??0).'</b></span>';
          echo '<span class="pill">copy <b>'.($by['copy']??0).'</b></span>';
          echo '<span class="pill">other <b>'.($by['other']??0).'</b></span>';
        ?>
      </span>
    </div>
  </div>

  <div class="stack">
    <div>PHP <?= PHP_VERSION ?> ·
      <code>Redis <?= function_exists('niulai_redis') ? '✓' : '—' ?></code> ·
      <code>SQLite <?= function_exists('niulai_db') ? '✓' : '—' ?></code></div>
    <div style="margin-top:6px">
      <a href="leaderboard.html">用户榜</a> ·
      <a href="api/rank.php" target="_blank">api/rank.php</a> ·
      <a href="api/share.php" target="_blank">api/share.php</a> ·
      <a href="api/pk.php" target="_blank">api/pk.php</a>
    </div>
  </div>

</div>
</body>
</html>
