const BLOCK_SIZE = 8;
const TILE_SIZE = 64;
const CLOUD_HEIGHT = -2;
const BLOCK_UNLOAD_DISTANCE = 2000;
const BLOCK_LOAD_WINDOW = 2;

var pod;
var cursors;
var seed = "potato";

var Tiles = {
    EMPTY: 0,
    ROCK: 1,
    RED: 2,
    GREEN: 3,
    BLUE: 4,
    CLOUD: 5,
};
Tiles["nonNull"] = [
    Tiles.ROCK,
    Tiles.RED,
    Tiles.GREEN,
    Tiles.BLUE,
    Tiles.CLOUD,
];
Tiles["solid"] = [
    Tiles.ROCK,
    Tiles.RED,
    Tiles.GREEN,
    Tiles.BLUE,
    Tiles.CLOUD,
];
Tiles["underground"] = [
    Tiles.ROCK,
    Tiles.RED,
    Tiles.GREEN,
    Tiles.BLUE,
];
Tiles["properties"] = {
    [Tiles.ROCK]: { name: "tile_rock", image: "terrain/rock.png" },
    [Tiles.RED]: { name: "tile_red", image: "terrain/red.png" },
    [Tiles.GREEN]: { name: "tile_green", image: "terrain/green.png" },
    [Tiles.BLUE]: { name: "tile_blue", image: "terrain/blue.png" },
    [Tiles.CLOUD]: { name: "tile_cloud", image: "terrain/cloud.png" },
};

class StringableVector2 extends Phaser.Math.Vector2 {
    toString() {
        return "vec2<" + this.x + "," + this.y + ">";
    }
}

function vec2(a, b) {
    return new StringableVector2(a, b)
}

class Block {
    
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.phaserGroup = null;
        this.phaserCollider = null;

        var rng = new Phaser.Math.RandomDataGenerator([seed, row.toString(), col.toString()]);
        this.tiles = [];

        for (var tileRow = 0; tileRow < BLOCK_SIZE; tileRow++) {
            this.tiles[tileRow] = []
            for (var tileCol = 0; tileCol < BLOCK_SIZE; tileCol++) {
                const globalRow = tileRow + BLOCK_SIZE * row;
                const globalCol = tileCol + BLOCK_SIZE * col;

                if (globalRow > 0) {
                    this.tiles[tileRow][tileCol] = rng.pick(Tiles.underground);
                } else if (globalRow < CLOUD_HEIGHT) {
                    if (rng.between(1, 100) < 5) {
                        this.tiles[tileRow][tileCol] = Tiles.CLOUD;
                    } else {
                        this.tiles[tileRow][tileCol] = Tiles.EMPTY;
                    }   
                } else {
                    this.tiles[tileRow][tileCol] = Tiles.EMPTY;
                }
            }
        }
    }

    centerLocation() {
        return vec2(
            this.col * TILE_SIZE * BLOCK_SIZE + TILE_SIZE * BLOCK_SIZE / 2,
            this.row * TILE_SIZE * BLOCK_SIZE + TILE_SIZE * BLOCK_SIZE / 2);
    }

    load(scene) {
        if (this.phaserGroup == null) {
            if (this.phaserCollider != null) {
                console.error("Group but no collider!?");
                this.phaserCollider.destroy();
                this.phaserCollider = null;
            }
            this.phaserGroup = scene.physics.add.staticGroup();
    
            for (var row = 0; row < BLOCK_SIZE; row++) {
                for (var col = 0; col < BLOCK_SIZE; col++) {
                    if (this.tiles[row][col] == Tiles.EMPTY) {
                        continue;
                    }
                    this.phaserGroup.create(
                        this.col * TILE_SIZE * BLOCK_SIZE + col * TILE_SIZE,
                        this.row * TILE_SIZE * BLOCK_SIZE + row * TILE_SIZE,
                        Tiles.properties[this.tiles[row][col]].name
                    ).setOrigin(0,0).setScale(4).refreshBody();
                }
            }
    
            this.phaserCollider = scene.physics.add.collider(pod, this.phaserGroup);
        }
    }

    unload() {
        if (this.phaserGroup != null) {
            this.phaserGroup.destroy(true);
            this.phaserGroup = null;
        }
        if (this.phaserCollider != null) {
            this.phaserCollider.destroy();
            this.phaserCollider = null;
        }
    }

    loaded() {
        return this.phaserGroup != null;
    }

    static getBlockContaining(x, y) {
        return vec2(Math.floor(y / (TILE_SIZE * BLOCK_SIZE)), Math.floor(x / (TILE_SIZE * BLOCK_SIZE)));
    }
}

class GameScene extends Phaser.Scene {

    constructor() {
        super('GameScene');
        this.blocks = {};
        this.loadedBlocks = [];
    }

    getBlock(pos) {
        if (this.blocks[pos] == null) {
            this.blocks[pos] = new Block(pos.x, pos.y);
        }
        return this.blocks[pos];
    }

    destroyTileContaining(x, y) {
        const blockPos = Block.getBlockContaining(x, y);
        const block = this.getBlock(blockPos);
        const relX = x - block.col * TILE_SIZE * BLOCK_SIZE;
        const relY = y - block.row * TILE_SIZE * BLOCK_SIZE;
        const tileCol = Math.floor(relX / TILE_SIZE);
        const tileRow = Math.floor(relY / TILE_SIZE);
        console.log(block);
        block.tiles[tileRow][tileCol] = Tiles.EMPTY;
        console.log(block);
        block.unload();
        block.load(this);
    }

    preload() {
        this.load.image('player', 'player/me.png');

        for (const tile of Tiles.nonNull) {
            this.load.image(Tiles.properties[tile].name, Tiles.properties[tile].image);
        }
    }

    manageLoaded() {
        const blockPosition = Block.getBlockContaining(pod.x, pod.y);
        for (var i = -BLOCK_LOAD_WINDOW; i <= BLOCK_LOAD_WINDOW; i++) {
            for (var j = -BLOCK_LOAD_WINDOW; j <= BLOCK_LOAD_WINDOW; j++) {
                const pos = vec2(i, j).add(blockPosition);
                const block = this.getBlock(pos);
                if (!block.loaded()) {
                    console.log("Loading block at " + pos)
                    block.load(this);
                    this.loadedBlocks.push(block);
                }
            }
        }

        this.loadedBlocks = this.loadedBlocks.filter(block => {
            const pos = block.centerLocation();
            if (Math.abs(pos.x - pod.x) > BLOCK_UNLOAD_DISTANCE
                    || Math.abs(pos.y - pod.y) > BLOCK_UNLOAD_DISTANCE) {
                console.log("Unloading block at " + block.row + ", " + block.col);
                block.unload();
                return false;
            }
            return true;
        });
    }

    create() {
        // Create mining pod
        pod = this.physics.add.sprite(0, 0, 'player');
        // pod.setBounce(0.2);

        // Have the camera follow the mining pod
        this.cameras.main.startFollow(pod);
        this.cameras.main.setZoom(0.5);

        // Load keyboard interface
        cursors = this.input.keyboard.createCursorKeys();

        for (var i = -1; i < 2; i++) {
            for (var j = -1; j < 2; j++) {
                const block = new Block(i, j);
                block.load(this);
                this.blocks[vec2(i, j)] = block;
                this.loadedBlocks.push(block);
            }
        }

        this.manageLoaded();
    }

    update() {
        if (cursors.left.isDown) {
            pod.setVelocityX(-640);
            if (pod.body.touching.left) {
                this.destroyTileContaining(pod.x - pod.width / 2 - 1, pod.y);
            }
        } else if (cursors.right.isDown) {
            pod.setVelocityX(640);
            if (pod.body.touching.right) {
                this.destroyTileContaining(pod.x + pod.width / 2 + 1, pod.y);
            }
        } else {
            pod.setVelocityX(0);
        }

        if (cursors.up.isDown && pod.body.touching.down) {
            pod.setVelocityY(-2000);
        }

        if (cursors.down.isDown && pod.body.touching.down) {
            this.destroyTileContaining(pod.x, pod.y + pod.height / 2 + 1);
        }
        
        this.manageLoaded();
    }
}


class BackgroundScene extends Phaser.Scene {

    constructor ()
    {
        super('BackgroundScene');
    }

    preload () {
        this.load.image('background', 'terrain/background.png');
    }

    create ()
    {
        this.add.image(0, 0, 'background').setOrigin(0,0).setScale(4);

        this.scene.launch('GameScene');
    }

    update ()
    {
    }
}


var config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 3000 },
            debug: false
        }
    },
    scene: [ BackgroundScene, GameScene ],
};

var game = new Phaser.Game(config);
