# SVG 扑克牌资源目录 (Poker SVG Cards Directory)

您可以将扑克牌的 SVG 文件放置于本目录 (`public/cards/`)，系统将在卡牌渲染时自动优先加载。

## 命名规范示例 (支持以下任意一种命名格式)

### 格式 1：点数 + 花色缩写 (推荐)
- 黑桃 (Spades): `AS.svg`, `KS.svg`, `QS.svg`, `JS.svg`, `10S.svg`, `9S.svg` ... `2S.svg`
- 红桃 (Hearts): `AH.svg`, `KH.svg`, `QH.svg`, `JH.svg`, `10H.svg`, `9H.svg` ... `2H.svg`
- 梅花 (Clubs): `AC.svg`, `KC.svg`, `QC.svg`, `JC.svg`, `10C.svg`, `9C.svg` ... `2C.svg`
- 方块 (Diamonds): `AD.svg`, `KD.svg`, `QD.svg`, `JD.svg`, `10D.svg`, `9D.svg` ... `2D.svg`

### 格式 2：花色全称 / 英文
- `spades_A.svg`, `hearts_10.svg`, `clubs_K.svg`, `diamonds_Q.svg`
- `A_of_spades.svg`, `10_of_hearts.svg`

### 牌背 (Face-down Back)
- `back.svg` 或 `card_back.svg`

---
> 💡 提示：您也可以在游戏右上角点击 **「卡牌换肤」** 按钮，直接在浏览器中批量拖拽上传 .svg 文件，即传即用，无需重启服务。
