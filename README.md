# pg-frogcross

**青蛙過街**：過馬路躲車、踩木筏過河、進頂部巢穴。純前端，無建置步驟。

致敬經典「過街／過河」街機類型，非任一商業作品復刻。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。

## 一鍵開 SAM 小

**[一鍵開 SAM 小](https://play.samkuo.me/?open=sampot/pg-frogcross&name=青蛙過街&fresh=1)**

```
https://play.samkuo.me/?open=sampot/pg-frogcross&name=青蛙過街&fresh=1
```

同源會重用本機已匯入的沙盒；`fresh=1` 強制新建。

## 試玩（本機）

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

## 操作

| 操作 | 說明 |
| --- | --- |
| **出發** | 開始／下一關／再來一局 |
| **方向鍵／WASD** | 一格一跳 |
| **畫面滑動** | 滑動決定方向 |
| **下方十字鍵** | 觸控移動 |
| **音效** | 開／關 Web Audio 音效 |

## 規則摘要

- 馬路：碰到車扣命
- 河面：必須站在木筏上，並跟著漂；落水或漂出畫面扣命
- 頂部四個空巢各進一次；全滿過關，之後車速加快
- 共 3 命；時間耗盡也扣命
- 最佳分數存於 `localStorage` 鍵 **`pg-frogcross-best`**

## License

MIT
