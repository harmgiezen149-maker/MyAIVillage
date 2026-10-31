// Everything that is placed by hand: where things are in the art.
// Town positions are in map units (the map is 2400 × 1792).
// Room positions are in room units (every room is 1200 × 896).

const MAP = { w: 2400, h: 1792, image: 'assets/map.jpg' };

// The open ground you can walk on (everything outside is forest).
const WALK_AREA = [
  [0, 790], [430, 790], [430, 700], [840, 700], [870, 540], [1060, 540], [1060, 30], [1450, 30],
  [1450, 110], [1790, 110], [1790, 440], [2070, 440], [2070, 330], [2345, 330], [2345, 830],
  [2400, 830], [2400, 1130], [2320, 1130], [2140, 1160], [1980, 1180], [1950, 1390], [1640, 1400],
  [1600, 1560], [1400, 1590], [1330, 1700], [1330, 1792], [1150, 1792], [1150, 1620],
  [820, 1610], [700, 1600], [590, 1720], [170, 1720], [160, 1250], [440, 1090], [440, 960], [0, 960],
];

// Buildings and other solid things in the art: [x, y, w, h], {ellipse: [cx, cy, rx, ry]},
// or { box, small: true } for small things whose foot blocks while the character can pass behind the rest.
// These shapes only feed tools/make_masks.js; the game itself walks on the layers in game/masks.js.
const MAP_OBSTACLES = [
  [0, 415, 245, 330],        // plain house, far top left
  [245, 560, 195, 205],      // trees between the two left houses
  [440, 420, 400, 260],      // counting house
  [705, 140, 330, 380],      // scholar's tower
  [1065, 150, 280, 365],     // town hall
  [1330, 25, 120, 445],      // bell tower
  [1470, 110, 320, 425],     // post house
  { box: [1565, 535, 85, 60], small: true },       // letter chest
  [1650, 440, 330, 330],     // crier's press
  { box: [1520, 630, 100, 95], small: true },      // notice board
  { box: [1790, 620, 45, 95], small: true },       // bell post
  [2075, 330, 270, 360],     // artisan's workshop
  { box: [2225, 755, 95, 60], small: true },       // workbench outside the workshop
  [450, 770, 200, 340],      // tall house left of the square (closed)
  [500, 990, 245, 305],      // family cottage
  { box: [440, 1100, 70, 170], small: true },      // vegetable boxes
  [825, 1130, 310, 265],     // guest cottage, bottom middle
  { box: [905, 1420, 95, 90], small: true },       // picnic table
  { box: [805, 1400, 70, 120], small: true },      // garden box
  { box: [725, 1395, 75, 75], small: true },       // toy cart
  { box: [1000, 1500, 150, 70], small: true },     // flower border
  { box: [1085, 1405, 50, 100], small: true },     // garden box
  [185, 1250, 375, 295],     // carrier's depot
  { box: [275, 1550, 70, 75], small: true },       // cart wheel
  [330, 1490, 240, 140],     // crates and barrels under the lean-to
  { box: [600, 1510, 70, 110], small: true },      // signpost
  [1270, 1070, 345, 330],    // herald's lodge
  [1600, 990, 330, 290],     // bard's house
  [1700, 1180, 150, 185],    // bandstand
  [1745, 880, 215, 260],     // tall house right of the square (closed)
  { box: [2140, 880, 170, 240], small: true },     // market stall
  [790, 1050, 70, 90],       // swing tree trunk
  { box: [1255, 1595, 50, 50], small: true },      // beacon brazier
  { ellipse: [1200, 860, 135, 85] }, // fountain
];

// Doors you can walk into. `room` is the interior to show; null means no interior yet.
const BUILDINGS = [
  { id: 'council-hall', name: 'Council Hall', job: 'Chief of Staff', door: [1194, 528], room: 'council-hall' },
  { id: 'post-house', name: 'Post House', job: 'Inbox & Email', door: [1562, 548], room: 'post-house' },
  { id: 'criers-press', name: "Crier's Press", job: 'AI News', door: [1716, 786], room: 'criers-press' },
  { id: 'scholars-tower', name: "Scholar's Tower", job: 'Research', door: [915, 532], room: 'scholars-tower' },
  { id: 'counting-house', name: 'Counting House', job: 'Money', door: [712, 692], room: 'counting-house' },
  { id: 'artisans-workshop', name: "Artisan's Workshop", job: 'Products', door: [2190, 712], room: 'artisans-workshop' },
  { id: 'family-cottage', name: 'Family Cottage', job: 'Family', door: [766, 1240], room: 'family-cottage' },
  { id: 'carriers-depot', name: "Carrier's Depot", job: 'Logistics', door: [256, 1560], room: 'carriers-depot' },
  { id: 'heralds-lodge', name: "Herald's Lodge", job: 'Outreach', door: [1380, 1408], room: 'heralds-lodge' },
  { id: 'bards-house', name: "Bard's House", job: 'Music', door: [1684, 1292], room: 'bards-house' },
  { id: 'guest-top-left', name: 'Guest House', job: 'Spare for a future agent', door: [125, 796], room: null },
  { id: 'guest-cottage', name: 'Guest Cottage', job: 'Spare for a future agent', door: [1045, 1408], room: null },
];

// The Chief Human Officer's walking sheet (tools/cut_character.py):
// rows walk down, right, left, up; columns left foot forward, standing, right foot forward.
const WALK_SHEET = {
  image: 'char:harm', src: 'assets/characters/harm-walk.png',
  frameW: 192, frameH: 256, foot: 244, figure: 236,
  rows: { down: 0, right: 1, left: 2, up: 3 },
};

const START = [1200, 1060]; // the CEO starts just below the fountain

// Props from the prop sheet: [image, x, y (feet), width, solid?]
const MAP_PROPS = [
  ['bench-iron', 1000, 1060, 92, true],
  ['bench-plain', 1425, 1052, 92, true],
  ['lamp-post', 965, 700, 30, true],
  ['lamp-post', 1435, 700, 30, true],
  ['lamp-hanging', 940, 1010, 50, true],
  ['lamp-hanging', 1460, 1010, 50, true],
  ['jukebox', 1330, 1012, 62, true],
  ['flowerbed-a', 1105, 650, 100, true],
  ['bush-small', 1050, 640, 52, true],
  ['bush-medium', 1395, 640, 62, true],
  ['barrel', 2322, 720, 34, true],
  ['barrel-lid', 2322, 768, 34, true],
  ['crate-stack', 2320, 820, 52, true],
  ['crate-small', 640, 1662, 38, true],
  ['crate-large', 590, 1650, 52, true],
  ['fence-straight', 470, 1700, 92, true],
  ['fence-corner', 1560, 1460, 92, true],
];

// Moving effects on the town map.
const MAP_FX = {
  smoke: [[568, 428], [1555, 292], [1872, 516], [2280, 424], [898, 1134], [497, 852], [1801, 902]],
  fire: [{ x: 1276, y: 1638, size: 16 }],                       // the beacon brazier
  glows: [
    { x: 1272, y: 1503, r: 22 }, { x: 1440, y: 1503, r: 22 }, { x: 1560, y: 1503, r: 22 }, // herald's lamps
    { x: 790, y: 605, r: 30, color: '255,215,120', sparkle: true },                       // gold disc sign
  ],
  orbs: [{ x: 1828, y: 425, r: 20 }],                           // crystal orb on the press roof
  fountain: { top: [1200, 768], bowl: [1200, 828, 48, 12], basin: [1200, 880, 95, 28], streams: [1137, 1165, 1237, 1265] },
  // Cloth that waves: [x, y, w, h, anchor] — anchor 'top' for hanging banners, 'left' for a flag on a pole.
  cloth: [
    [1222, 34, 50, 32, 'left'],      // town hall roof flag
    [1080, 393, 235, 80, 'top'],     // town hall banners
    [1342, 342, 96, 86, 'top'],      // bell tower banners
    [1462, 1166, 102, 66, 'top'],    // herald's roof banners
    [1242, 1322, 40, 72, 'top'],     // herald's side banner
    [1568, 1322, 44, 44, 'top'],     // herald's side banner
    [940, 1088, 186, 56, 'top'],     // washing line
  ],
  jukebox: [1330, 1012],
};

// Interiors. floor = walkable box, exit = where the bottom door is, obstacles as above.
const ROOMS = {
  'council-hall': {
    floor: [150, 345, 980, 455], exit: [600, 712], start: [700, 690],
    obstacles: [[530, 335, 150, 325], [445, 360, 85, 270], [680, 360, 85, 270], [565, 600, 75, 95], [555, 230, 100, 120], [1010, 360, 150, 250], [380, 270, 60, 100]],
    fire: [{ x: 1062, y: 528, size: 18 }],
    glows: [[310, 178, 26], [225, 382, 26], [900, 180, 26], [985, 386, 26], [410, 286, 16]],
    props: [['council-chair-b', 492, 662, 62], ['council-chair-a', 712, 662, 62]], // the 11th and 12th chairs
  },
  'family-cottage': {
    floor: [60, 330, 1090, 420], exit: [600, 600], start: [600, 535],
    obstacles: [[140, 290, 400, 215], [770, 390, 340, 230], [765, 235, 190, 120], [485, 195, 240, 150], [125, 470, 75, 90]],
    fire: [{ x: 600, y: 300, size: 34 }],
    glows: [[275, 140, 14], [470, 140, 14], [740, 140, 14], [152, 243, 14], [85, 375, 14], [30, 460, 14], [1057, 230, 14], [1132, 372, 14], [1178, 455, 14]],
  },
  'criers-press': {
    floor: [70, 330, 1080, 410], exit: [600, 735],
    obstacles: [[405, 180, 140, 295], [545, 300, 185, 125], [80, 425, 180, 210], [560, 470, 85, 135], [785, 330, 320, 295]],
    orbs: [{ x: 602, y: 466, r: 30 }],
  },
  'post-house': {
    floor: [110, 420, 980, 225], exit: [600, 640],
    obstacles: [[650, 395, 205, 245], [860, 405, 160, 210]],
    glows: [[702, 366, 18]],
  },
  'counting-house': {
    floor: [130, 390, 960, 335], exit: [600, 610], start: [600, 548],
    obstacles: [[245, 405, 340, 175], [800, 405, 190, 220], [785, 330, 80, 80]],
    glows: [[923, 430, 18, '190,255,170']],
  },
  'scholars-tower': {
    floor: [60, 340, 1090, 400], exit: [600, 735],
    obstacles: [[190, 390, 350, 150], [150, 230, 360, 150], [790, 340, 310, 275], [940, 290, 110, 70]],
  },
  'artisans-workshop': {
    floor: [120, 420, 860, 330], exit: [380, 690], start: [520, 570],
    obstacles: [[465, 580, 235, 200], [730, 280, 380, 370], [80, 230, 580, 330], [255, 405, 215, 175]],
  },
  'bards-house': {
    floor: [100, 360, 1040, 400], exit: [600, 595], start: [600, 535],
    obstacles: [[410, 320, 390, 180], [860, 340, 140, 140], [110, 440, 180, 240], [280, 440, 105, 160]],
    glows: [[180, 420, 16]],
  },
  'heralds-lodge': {
    floor: [40, 375, 1120, 400], exit: [600, 600], start: [600, 548],
    obstacles: [[85, 380, 460, 305], [600, 355, 230, 120], [960, 415, 170, 260], [170, 285, 110, 140]],
  },
  'carriers-depot': {
    floor: [40, 325, 1120, 480], exit: [600, 650], start: [600, 590],
    obstacles: [[30, 315, 195, 470], [770, 100, 360, 465], [280, 355, 385, 175], [610, 315, 130, 155], [750, 490, 275, 240]],
    glows: [[951, 502, 18, '190,255,170']],
  },
};
