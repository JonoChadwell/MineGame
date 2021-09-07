// World primitives.
const BLOCK_SIZE = 8; // tiles in a block
const TILE_SIZE = 16; // size of a tile in world coordinates
const TILE_GRAPHIC_SIZE = 16; // size of the tile graphic in pixels
const PLAYER_GRAPHIC_SIZE = 40; // size of the player graphic in pixels
const MAP_SEED = 0;

// Game balance numbers.
const PLAYER_SPEED = TILE_SIZE * 10;
const PLAYER_DOWN_SPEED = TILE_SIZE * 3;
const JUMP_VELOCITY = 400;
const GRAVITY = 400;

// Camera parameters.
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const CAMERA_ZOOM = 1;
const CAMERA_Y_OFFSET = -100;

const BLOCK_UNLOAD_DISTANCE = VIEW_WIDTH;
const BLOCK_LOAD_WINDOW = 4;

var pod;
var cursors;

///////////////////////////////////////////////////////////////////////////////
// Tiles
///////////////////////////////////////////////////////////////////////////////

// A tile is a single occupied / unoccupied square in the world.

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


///////////////////////////////////////////////////////////////////////////////
// Assertions
///////////////////////////////////////////////////////////////////////////////

function assert(value) {
    if (!value) {
        throw 'bad assertion: ' + value
    }
}

function assertObjectEquals(a, b) {
    if (!a.equals(b)) {
        throw 'bad assertion: "' + a + '" equals "' + b + '"'
    }
}

function testAssert() {
    assert(true)
}


///////////////////////////////////////////////////////////////////////////////
// Math
///////////////////////////////////////////////////////////////////////////////

function remainder(a, b) {
    const maybenegative = a % b;
    if (maybenegative < 0) {
        return maybenegative + b;
    } else {
        return maybenegative;
    }
}

function testRemainder() {
    assert(remainder(1, 3) == 1)
    assert(remainder(5, 3) == 2)
    assert(remainder(9, 3) == 0)
    assert(remainder(-1, 3) == 2)
    assert(remainder(-9, 3) == 0)
}


///////////////////////////////////////////////////////////////////////////////
// Vectors with implemented toString
///////////////////////////////////////////////////////////////////////////////

class StringableVector2 extends Phaser.Math.Vector2 {
    toString() {
        return "vec2<" + this.x + "," + this.y + ">";
    }

    row() {
        return this.x;
    }

    col() {
        return this.y;
    }
}

function vec2(a, b) {
    return new StringableVector2(a, b)
}


///////////////////////////////////////////////////////////////////////////////
// Coordinate conversion functions
///////////////////////////////////////////////////////////////////////////////

function world2block(x, y) {
    if (arguments.length == 1) {
        return world2block(x.x, x.y);
    }
    return vec2(Math.floor(y / (TILE_SIZE * BLOCK_SIZE)), Math.floor(x / (TILE_SIZE * BLOCK_SIZE)));
}

function world2tile(x, y) {
    if (arguments.length == 1) {
        return world2tile(x.x, x.y);
    }
    return vec2(Math.floor(y / TILE_SIZE), Math.floor(x / TILE_SIZE));
}

// Returns the world coordinates of the center of a tile
function tile2world(row, col) {
    if (arguments.length == 1) {
        return tile2world(row.row(), row.col());
    }
    return vec2((Math.floor(col) + 0.5) * TILE_SIZE, (Math.floor(row) + 0.5) * TILE_SIZE);
}

// Get the block coordinates of the block containing a tile
function tile2block(row, col) {
    if (arguments.length == 1) {
        return tile2block(row.row(), row.col());
    }
    return vec2(Math.floor(row / BLOCK_SIZE), Math.floor(col / BLOCK_SIZE));
}

function block2world(row, col) {
    if (arguments.length == 1) {
        return block2world(row.row(), row.col());
    }
    return vec2((Math.floor(col) + 0.5) * TILE_SIZE * BLOCK_SIZE, (Math.floor(row) + 0.5)  * TILE_SIZE * BLOCK_SIZE);
}

function tile2subtile(row, col) {
    if (arguments.length == 1) {
        return tile2subtile(row.row(), row.col());
    }
    return vec2(remainder(Math.floor(row), BLOCK_SIZE), remainder(Math.floor(col), BLOCK_SIZE));
}

function testConversions() {
    assertObjectEquals(world2block(1.5,1), vec2(0,0))
    assertObjectEquals(world2block(-1,1), vec2(0,-1))
    assertObjectEquals(world2block(vec2(0, TILE_SIZE * BLOCK_SIZE * 100 + TILE_SIZE / 2)), vec2(100,0))

    assertObjectEquals(world2tile(vec2(0, TILE_SIZE * BLOCK_SIZE * 100 + TILE_SIZE / 2)), vec2(BLOCK_SIZE * 100,0))

    assertObjectEquals(tile2world(vec2(0,0)), vec2(TILE_SIZE/2, TILE_SIZE/2))
    assertObjectEquals(tile2world(vec2(5,0)), vec2(TILE_SIZE/2, TILE_SIZE * 5.5))

    assertObjectEquals(tile2block(vec2(BLOCK_SIZE*13.2,BLOCK_SIZE * 7.9)), vec2(13, 7))

    assertObjectEquals(block2world(vec2(5,7)), vec2(7.5*BLOCK_SIZE*TILE_SIZE, 5.5*BLOCK_SIZE*TILE_SIZE))

    assertObjectEquals(tile2subtile(vec2(BLOCK_SIZE*13+3,BLOCK_SIZE*19+5)), vec2(3,5))
}


///////////////////////////////////////////////////////////////////////////////
// World Generation
///////////////////////////////////////////////////////////////////////////////

function simplex(tile, row, col, frequency, size) {
    const SCALAR = 10;
    const value = (noise.simplex2(tile * 100 + row / size / SCALAR, col / size / SCALAR) + 1) / 2;
    return value < frequency;
}

const GENERATION_PARAMS = [
    {
        tile: Tiles.GREEN,
        rule: (row, col) => row > 10 && simplex(Tiles.GREEN, row, col * 5, 0.2, 20),
    },
    {
        tile: Tiles.BLUE,
        rule: (row, col) => row > 1 && simplex(Tiles.BLUE, row, col, 0.1, 1),
    },
    {
        tile: Tiles.RED,
        rule: (row, col) => row > 1 && noise.simplex2(row / 10 + 10000, col / 10) > 0.7,
    },
    {
        tile: Tiles.CLOUD,
        rule: (row, col) => row < -3 && simplex(Tiles.CLOUD, row * 10, col, 0.2, 1),
    },
    {
        tile: Tiles.ROCK,
        rule: (row, col) => row == 0 || (row > 0 && simplex(Tiles.ROCK, row, col, 0.8, 1)),
    },
];

function generateTile(row, col) {
    for (var generator of GENERATION_PARAMS) {
        if (generator.rule(row, col)) {
            return generator.tile;
        }
    }
    return Tiles.EMPTY;
}


///////////////////////////////////////////////////////////////////////////////
// Blocks
///////////////////////////////////////////////////////////////////////////////

// A block is a group of tiles that may be dynamically loaded and unloaded.

class Block {
    
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.phaserGroup = null;
        this.phaserCollider = null;

        this.tiles = [];

        for (var tileRow = 0; tileRow < BLOCK_SIZE; tileRow++) {
            this.tiles[tileRow] = []
            for (var tileCol = 0; tileCol < BLOCK_SIZE; tileCol++) {
                const globalRow = tileRow + BLOCK_SIZE * row;
                const globalCol = tileCol + BLOCK_SIZE * col;

                this.tiles[tileRow][tileCol] = generateTile(globalRow, globalCol);
            }
        }
    }

    centerLocation() {
        return block2world(this.row, this.col);
    }

    load(scene) {
        // console.log("Loading block " + this.row + ", " + this.col)
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
                    ).setOrigin(0,0).setScale(TILE_SIZE / TILE_GRAPHIC_SIZE).refreshBody();
                }
            }
    
            this.phaserCollider = scene.physics.add.collider(pod, this.phaserGroup);
        }
    }

    unload() {
        // console.log("Unoading block " + this.row + ", " + this.col)
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
}


///////////////////////////////////////////////////////////////////////////////
// Background Image
///////////////////////////////////////////////////////////////////////////////

class BackgroundScene extends Phaser.Scene {

    constructor ()
    {
        super('BackgroundScene');
    }

    // Phaser preload
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


///////////////////////////////////////////////////////////////////////////////
// Core Game Logic
///////////////////////////////////////////////////////////////////////////////

class GameScene extends Phaser.Scene {

    constructor() {
        super('GameScene');
        this.blocks = {};
        this.loadedBlocks = [];
    }

    // Phaser preload
    preload() {
        this.load.image('player', 'player/me.png');

        for (const tile of Tiles.nonNull) {
            this.load.image(Tiles.properties[tile].name, Tiles.properties[tile].image);
        }
    }

    getBlock(pos) {
        if (this.blocks[pos] == null) {
            this.blocks[pos] = new Block(pos.x, pos.y);
        }
        return this.blocks[pos];
    }

    destroyTile(row, col) {
        if (arguments.length == 1) {
            this.destroyTile(row.row(), row.col());
        }

        const blockPos = tile2block(row, col);
        const subtile = tile2subtile(row, col);
        const block = this.getBlock(blockPos);

        block.tiles[subtile.row()][subtile.col()] = Tiles.EMPTY;
        block.unload();
        block.load(this);
    }

    manageLoaded() {
        const blockPosition = world2block(pod.x, pod.y);
        for (var i = -BLOCK_LOAD_WINDOW; i <= BLOCK_LOAD_WINDOW; i++) {
            for (var j = -BLOCK_LOAD_WINDOW; j <= BLOCK_LOAD_WINDOW; j++) {
                const pos = vec2(i, j).add(blockPosition);
                const block = this.getBlock(pos);
                if (!block.loaded()) {
                    block.load(this);
                    this.loadedBlocks.push(block);
                }
            }
        }

        this.loadedBlocks = this.loadedBlocks.filter(block => {
            const pos = block.centerLocation();
            if (Math.abs(pos.x - pod.x) > BLOCK_UNLOAD_DISTANCE
                    || Math.abs(pos.y - pod.y) > BLOCK_UNLOAD_DISTANCE) {
                block.unload();
                return false;
            }
            return true;
        });
    }

    create() {
        // Create mining pod.
        pod = this.physics.add.sprite(0, -PLAYER_GRAPHIC_SIZE / 2, 'player');
        pod.targetX = 0;
        // pod.setBounce(0.2);

        // Have the camera follow the mining pod.
        this.cameras.main.startFollow(pod);
        this.cameras.main.setFollowOffset(0, CAMERA_Y_OFFSET);
        this.cameras.main.setZoom(CAMERA_ZOOM);

        // Load keyboard interface.
        cursors = this.input.keyboard.createCursorKeys();

        this.manageLoaded();
    }

    update() {
        const podTile = world2tile(pod.x, pod.y);
        // console.log("x is " + pod.x + " target is " + pod.targetX);
        if (cursors.left.isDown) {
            pod.targetX = tile2world(podTile.row(), podTile.col() - 1).x;
        } else if (cursors.right.isDown) {
            pod.targetX = tile2world(podTile.row(), podTile.col() + 1).x;
        }
        if (pod.body.touching.left) {
            this.destroyTile(podTile.row() + 1, podTile.col() - 2);
            this.destroyTile(podTile.row(), podTile.col() - 2);
            this.destroyTile(podTile.row() - 1, podTile.col() - 2);
        }
        if (pod.body.touching.right) {
            this.destroyTile(podTile.row() + 1, podTile.col() + 2);
            this.destroyTile(podTile.row(), podTile.col() + 2);
            this.destroyTile(podTile.row() - 1, podTile.col() + 2);
        }

        if (pod.x < pod.targetX) {
            const scale = Math.min(1, ((pod.targetX - pod.x) / (PLAYER_SPEED / 10)));
            pod.setVelocityX(PLAYER_SPEED * scale);
        } else {
            const scale = Math.min(1, ((pod.x - pod.targetX) / (PLAYER_SPEED / 10)));
            pod.setVelocityX(-PLAYER_SPEED * scale);
        }

        if (cursors.up.isDown && pod.body.touching.down) {
            pod.setVelocityY(-JUMP_VELOCITY);
        }

        if (cursors.down.isDown && pod.body.touching.down) {
            const targetCol = pod.targetX / TILE_SIZE
            this.destroyTile(podTile.row() + 2, targetCol + 1);
            this.destroyTile(podTile.row() + 2, targetCol);
            this.destroyTile(podTile.row() + 2, targetCol - 1);
            pod.setVelocityY(PLAYER_DOWN_SPEED);
        }
        
        this.manageLoaded();
    }
}


///////////////////////////////////////////////////////////////////////////////
// Simple Unit Testing
///////////////////////////////////////////////////////////////////////////////

// Yes - running unit tests on every game load is a little extreme. However
// learning to properly unit test javascript makes me want to gag so deal.

function testAll() {
    testAssert()
    testRemainder()
    testConversions()
}

testAll()


///////////////////////////////////////////////////////////////////////////////
// Phaser3 Initialization
///////////////////////////////////////////////////////////////////////////////

var config = {
    type: Phaser.AUTO,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: GRAVITY },
            debug: false
        }
    },
    scene: [ BackgroundScene, GameScene ],
};

noise.seed(MAP_SEED)
var game = new Phaser.Game(config);
