// ------------------ Scene 클래스 선언 ------------------
class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload() {
    const suits = ["C", "D", "H", "S"];
    const ranks = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "0",
      "J",
      "Q",
      "K",
    ];
    for (let s of suits) {
      for (let r of ranks) {
        const key = r + s;
        this.load.image(
          key,
          `https://deckofcardsapi.com/static/img/${key}.png`
        );
      }
    }
    this.load.image("back", "https://deckofcardsapi.com/static/img/back.png");
  }

  create() {
    this.scene.start("GameScene");
  }
}

// ------------------ Game Scene ------------------
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.deck = [];
    this.tableau = [];
    this.foundation = [[], [], [], []];
    this.stock = [];
    this.waste = [];
    this.cardSprites = new Map();
    this.foundationX = [];
    this.foundationY = 50;
  }

  create() {
    this.initDeck();
    Phaser.Utils.Array.Shuffle(this.deck);

    this.dealTableau();
    this.initStock();
    this.initFoundation();

    this.input.on("dragstart", (pointer, card) => card.setDepth(1000));
    this.input.on("drag", (pointer, card, dragX, dragY) => {
      card.x = dragX;
      card.y = dragY;
    });
    this.input.on("dragend", (pointer, card) => this.handleDrop(card));

    this.input.on("pointerdown", (pointer, gameObjects) => {
      if (!gameObjects.length) return;
      const obj = gameObjects[0];
      if (obj.getData("pile") === "stock") this.drawFromStock();
    });
  }

  initDeck() {
    const suits = ["C", "D", "H", "S"];
    const ranks = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "0",
      "J",
      "Q",
      "K",
    ];
    for (let s of suits) for (let r of ranks) this.deck.push(r + s);
  }

  dealTableau() {
    const cardWidth = 80,
      cardHeight = 120;
    const startX = 112,
      startY = 250;
    const colSpacing = 120,
      rowSpacing = 25;

    for (let i = 0; i < 7; i++) {
      this.tableau[i] = [];
      for (let j = 0; j <= i; j++) {
        const key = this.deck.pop();
        const faceUp = j === i;
        const y = startY + j * rowSpacing;
        const x = startX + i * colSpacing;

        const sprite = this.add
          .image(x, y, faceUp ? key : "back")
          .setInteractive()
          .setDisplaySize(cardWidth, cardHeight)
          .setData({ key, pile: "tableau", col: i, faceUp });

        if (faceUp) sprite.setDepth(500);
        this.input.setDraggable(sprite);
        this.tableau[i].push(sprite);
      }
    }
  }

  initStock() {
    const cardWidth = 80,
      cardHeight = 120;
    const x = 112,
      y = 50;
    this.stock = this.deck.slice();
    this.deck = [];
    this.stock.forEach((key, idx) => {
      const sprite = this.add
        .image(x, y, "back")
        .setInteractive()
        .setDisplaySize(cardWidth, cardHeight)
        .setData({ key, pile: "stock" });
      this.cardSprites.set(key + "_stock_" + idx, sprite);
    });
  }

  initFoundation() {
    const cardWidth = 80;
    const startX = 584,
      spacing = 120;
    for (let i = 0; i < 4; i++) {
      const x = startX + i * spacing;
      const y = this.foundationY;
      this.foundationX[i] = x;
      const slot = this.add
        .rectangle(x, y, cardWidth, 120, 0x006600)
        .setStrokeStyle(1, 0xcccccc)
        .setOrigin(0, 0);
      slot.setData("pile", "foundation");
    }
  }

  drawFromStock() {
    if (this.stock.length === 0) {
      while (this.waste.length > 0) {
        let card = this.waste.pop();
        this.stock.push(card.getData("key"));
        card.destroy();
      }
      return;
    }
    const key = this.stock.pop();
    const baseX = 232,
      y = 50;
    const offsetX = this.waste.length * 5;
    const sprite = this.add
      .image(baseX + offsetX, y, key)
      .setInteractive()
      .setDisplaySize(80, 120)
      .setData({ key, pile: "waste", faceUp: true })
      .setDepth(500 + this.waste.length);
    this.input.setDraggable(sprite);
    this.waste.push(sprite);
  }

  handleDrop(card) {
    if (!card.getData("faceUp")) {
      card.x = card.input.dragStartX;
      card.y = card.input.dragStartY;
      return;
    }

    const key = card.getData("key");
    const rank = this.getRank(key);
    const suit = this.getSuit(key);

    // ---------------- Foundation 이동 ----------------
    for (let i = 0; i < 4; i++) {
      const pile = this.foundation[i];
      const x = this.foundationX[i];
      const y = this.foundationY;

      if (pile.length === 0 && rank === 1) {
        // A 카드
        card.x = x;
        card.y = y; // 첫 카드는 슬롯 기준
        this.removeFromOldPile(card);
        pile.push(card);
        card.setData("pile", "foundation");
        card.setData("foundationIndex", i);
        card.setDepth(100 + pile.length);
        return;
      }
      if (pile.length > 0) {
        // 이후 카드
        const topCard = pile[pile.length - 1];
        const topRank = this.getRank(topCard.getData("key"));
        const topSuit = this.getSuit(topCard.getData("key"));
        if (suit === topSuit && rank === topRank + 1) {
          card.x = x;
          card.y = y + pile.length * 30; // 아래로 쌓임
          this.removeFromOldPile(card);
          pile.push(card);
          card.setData("pile", "foundation");
          card.setData("foundationIndex", i);
          card.setDepth(100 + pile.length);
          return;
        }
      }
    }

    // ---------------- Tableau 이동 ----------------
    for (let i = 0; i < this.tableau.length; i++) {
      const col = this.tableau[i];
      const top = col[col.length - 1];

      if (col.length === 0 && rank === 13) {
        card.x = 112 + i * 120;
        card.y = 250;
        this.removeFromOldPile(card);
        col.push(card);
        card.setData("pile", "tableau");
        card.setData("col", i);
        card.setDepth(500);
        return;
      }

      if (top && top.getData("faceUp")) {
        const topKey = top.getData("key");
        const topRank = this.getRank(topKey);
        const topColor = this.getColor(this.getSuit(topKey));
        const color = this.getColor(suit);

        if (rank + 1 === topRank && color !== topColor) {
          card.x = top.x;
          card.y = top.y + 25;
          this.removeFromOldPile(card);
          col.push(card);
          card.setData("pile", "tableau");
          card.setData("col", i);
          card.setDepth(500);
          return;
        }
      }
    }

    card.x = card.input.dragStartX;
    card.y = card.input.dragStartY;
  }

  removeFromOldPile(card) {
    const currentPile = card.getData("pile");
    if (currentPile === "tableau") {
      const origCol = card.getData("col");
      if (origCol !== undefined) {
        Phaser.Utils.Array.Remove(this.tableau[origCol], card);
        const prev = this.tableau[origCol][this.tableau[origCol].length - 1];
        if (prev && !prev.getData("faceUp")) {
          prev.setTexture(prev.getData("key"));
          prev.setData("faceUp", true);
          prev.setDepth(500);
        }
      }
    } else if (currentPile === "waste") {
      Phaser.Utils.Array.Remove(this.waste, card);
    } else if (currentPile === "foundation") {
      const origIndex = card.getData("foundationIndex");
      if (origIndex !== undefined) {
        Phaser.Utils.Array.Remove(this.foundation[origIndex], card);
      }
    }
  }

  getRank(key) {
    const r = key.slice(0, -1);
    if (r === "A") return 1;
    if (r === "J") return 11;
    if (r === "Q") return 12;
    if (r === "K") return 13;
    if (r === "0") return 10;
    return parseInt(r);
  }

  getSuit(key) {
    return key.slice(-1);
  }
  getColor(suit) {
    return suit === "H" || suit === "D" ? "red" : "black";
  }
}

// ------------------ Phaser Game 생성 ------------------
const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: 0x006400,
  scene: [PreloadScene, GameScene],
};

const game = new Phaser.Game(config);
