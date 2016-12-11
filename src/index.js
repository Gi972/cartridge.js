var help = require('./help');
var input = require('./input');
var utils = require('./utils');
var font = require('./font');
var math = require('./math');
var colors = require('./colors');
var sfx = require('./sfx');
var pixelops = require('./pixelops');

var cellsizeX = 8; // pixels
var cellsizeY = 8; // pixels
var screensizeX = 128; // pixels
var screensizeY = 128; // pixels
var mapSizeX = 128; // cells
var mapSizeY = 32; // cells
var spriteSheetSizeX = 16; // sprites
var spriteSheetSizeY = 16; // sprites

var maxSprites = spriteSheetSizeX * spriteSheetSizeY; // sprites

// DOM elements
var container;
var canvases = [];

// Listeners/callbacks
var canvasListeners;
var bodyListeners;

var mapData = utils.zeros(mapSizeX * mapSizeY);
var mapDataDirty = utils.zeros(mapSizeX * mapSizeY); // dirtiness per cell
var mapDirty = true; // is all of the map dirty?
var mapCacheCanvas;
var mapCacheContext;
var spriteSheetCanvas;
var spriteSheetContext;
var spriteFlags = utils.zeros(maxSprites);
var ctx;
var _time = 0;
var camX = 0;
var camY = 0;
var palette;
var paletteHex;
var defaultColor = 0;
var transparentColors = utils.zeros(16).map(function(){ return false; });
transparentColors[0] = true;
var loaded = false; // Loaded state
var _alpha = 0;
var code = '';

exports.cartridge = function(options){
	screensizeX = options.width !== undefined ? options.width : 128; // deprecated
	screensizeY = options.height !== undefined ? options.height : 128; // deprecated
	cellsizeX = options.cellwidth !== undefined ? options.cellwidth : 8; // deprecated
	cellsizeY = options.cellheight !== undefined ? options.cellheight : 8; // deprecated

	var numCanvases = options.layers !== undefined ? options.layers : 1;
	container = options.containerId ? document.getElementById(options.containerId) : null;
	container.innerHTML = '';
	for(var i=0; i<numCanvases; i++){
		container.innerHTML += '<canvas class="cartridgeCanvas" id="cartridgeCanvas'+i+'" width="' + screensizeX + '" height="' + screensizeY + '"' + (i === 0 ? ' moz-opaque' : '') + '></canvas>';
	}

	for(var i=0; i<numCanvases; i++){
		var c = document.getElementById('cartridgeCanvas' + i);
		c.oncontextmenu = function(){
			return false;
		};
		canvases.push(c);
		if(i !== 0){
			c.style.pointerEvents = 'none';
		}
		c.style.position = 'absolute';
		utils.disableImageSmoothing(c.getContext('2d'));
	}

	if(options.palette){
		setPalette(options.palette);
	} else {
		setPalette(colors.defaultPalette());
	}

	// Add style tag
	var style = document.createElement('style');
	style.innerHTML = [
		".cartridgeCanvas {",
		"image-rendering: -moz-crisp-edges;",
		"image-rendering: -webkit-crisp-edges;",
		"image-rendering: pixelated;",
		"}"
	].join('\n');
	document.getElementsByTagName('head')[0].appendChild(style);

	setCellSize(cellsizeX, cellsizeY);

	// Set main canvas
	canvas(0);

	input.init(canvases);
	pixelops.init(canvases[0]); // todo: support multiple

	fit();

	// Start render loop
	var currentTime = 0;
	var t0 = 0;
	var t1 = 0;
	var dt0 = Math.floor(1 / 30 * 1000);
	var dt1 = Math.floor(1 / 60 * 1000);
	var accumulator0 = 0;
	var accumulator1 = 0;
	function render(newTime){
		if (currentTime) {
			var frameTime = newTime - currentTime;
			if ( frameTime > 250 )
				frameTime = 250;
			accumulator0 += frameTime;
			while ( accumulator0 >= dt0 ){
				_time = t0;
				t0 += dt0;
				accumulator0 -= dt0;
				_alpha = accumulator0 / dt0;
				if(loaded && typeof(_update) !== 'undefined'){
					try {
						_update();
					} catch(err){
						console.error(err);
					}
				}
			}
			accumulator1 += frameTime;
			while ( accumulator1 >= dt1 ){
				_time = t1;
				t1 += dt1;
				accumulator1 -= dt1;
				_alpha = accumulator1 / dt1;
				if(loaded && typeof(_update60) !== 'undefined'){
					try {
						_update60();
					} catch(err){
						console.error(err);
					}
				}
			}
		}
		_time = newTime;
		if(loaded && typeof(_draw) !== 'undefined'){
			try {
				_draw();
			} catch(err){
				console.error(err);
			}
		}

		// Flush any remaining pixelops
		pixelops.flush();

		currentTime = newTime;
		input.update();
		requestAnimationFrame(render);
	}
	requestAnimationFrame(render);

	// Init font
	font.load(function(image){
		font.init(image, palette);

		if(code){
			// Run code. If there's an error, let it throw.
			eval.call(null, code);
		}

		// Run the _load function
		if(typeof(_load) !== 'undefined'){
			try {
				_load(postLoad);
			} catch(err){
				console.error(err);
				postLoad(err);
			}
		} else {
			postLoad();
		}
	});
};

function postLoad(err){
	loaded = true;
	if(typeof(_init) !== 'undefined'){
		try {
			_init();
		} catch(err){
			console.error(err);
		}
	}
}

function setCellSize(w,h){
	w = w | 0;
	h = h | 0;

	cellsizeX = w;
	cellsizeY = h;

	// (re)init spritesheet canvas
	// TODO: copy over somehow?
	spriteSheetCanvas = utils.createCanvas(spriteSheetSizeX * cellsizeX, spriteSheetSizeY * cellsizeY);
	spriteSheetContext = spriteSheetCanvas.getContext('2d');

	// (re)init map cache
	mapCacheCanvas = utils.createCanvas(mapSizeX * cellsizeX, mapSizeY * cellsizeY);
	mapCacheContext = mapCacheCanvas.getContext('2d');
}

function setPalette(p){
	palette = p.slice(0);
	paletteHex = palette.map(colors.int2hex);
	mapDirty = true;
}

exports.palset = function(n, hexColor){
	var newPalette = palette.slice(0);
	newPalette[n] = hexColor;
	setPalette(newPalette);
};

exports.palget = function(n){
	return palette[n];
};

function resizeCanvases(){
	sgetData = null;
	for(var i=0; i < canvases.length; i++){
		canvases[i].width = screensizeX;
		canvases[i].height = screensizeY;
	}
	fit();
	pixelops.resize(canvases[0]);
}

exports.alpha = function(){ return _alpha; }; // for interpolation

// TODO: rename to wget/set() ?
exports.width = function(newWidth){
	if(newWidth !== undefined){
		screensizeX = newWidth | 0;
		resizeCanvases();
	}
	return screensizeX;
};

// TODO: rename to hget/set() ?
exports.height = function(newHeight){
	if(newHeight !== undefined){
		screensizeY = newHeight | 0;
		resizeCanvases();
	}
	return screensizeY;
};

// TODO: rename to cwget/set() ?
exports.cellwidth = function(newCellWidth){
	if(newCellWidth !== undefined){
		setCellSize(newCellWidth, cellsizeY);
	} else {
		return cellsizeX;
	}
};

// TODO: rename to chget/set() ?
exports.cellheight = function(newCellHeight){
	if(newCellHeight !== undefined){
		setCellSize(cellsizeX, newCellHeight);
	} else {
		return cellsizeY;
	}
};

exports.cls = function(){
	pixelops.beforeChange();
	ctx.clearRect(-camX,-camY,screensizeX,screensizeY);
};

exports.time = function(){
	return _time / 1000;
};

exports.color = function(col){
	defaultColor = col;
};

exports.palt = function(col, t){
	transparentColors[col] = t;
};

exports.rectfill = function rectfill(x0, y0, x1, y1, col){
	pixelops.beforeChange();
	// Floor coords
	x0 = x0 | 0;
	y0 = y0 | 0;
	x1 = x1 | 0;
	y1 = y1 | 0;
	col = col !== undefined ? col : defaultColor;

	var w = x1 - x0 + 1;
	var h = y1 - y0 + 1;
	ctx.fillStyle = paletteHex[col];
	ctx.fillRect(x0, y0, w, h);
};

exports.rect = function rect(x0, y0, x1, y1, col){
	pixelops.beforeChange();
	// Floor coords
	x0 = x0 | 0;
	y0 = y0 | 0;
	x1 = x1 | 0;
	y1 = y1 | 0;
	col = col !== undefined ? col : defaultColor;

	var w = x1 - x0;
	var h = y1 - y0;
	ctx.fillStyle = paletteHex[col];
	ctx.fillRect(x0, y0, w, 1);
	ctx.fillRect(x0, y0, 1, h);
	ctx.fillRect(x1, y0, 1, h+1);
	ctx.fillRect(x0, y1, w+1, 1);
};

exports.clip = function(x,y,w,h){
	x = x | 0;
	y = y | 0;
	w = w | 0;
	h = h | 0;

	ctx.rect(x,y,w,h);
	ctx.clip();
};

exports.canvas = function canvas(n){
	ctx = canvases[n].getContext('2d');
};

exports.camera = function camera(x, y){
	x = x | 0;
	y = y | 0;
	if(camX === x && camY === y) return;

	ctx.translate(x - camX, y - camY);
	camX = x;
	camY = y;
};

exports.map = function map(cel_x, cel_y, sx, sy, cel_w, cel_h, layer){
	pixelops.beforeChange();
	layer = layer === undefined ? 0 : layer;

	cel_x = cel_x | 0;
	cel_y = cel_y | 0;
	sx = sx | 0;
	sy = sy | 0;
	cel_w = cel_w | 0;
	cel_h = cel_h | 0;

	var i,j;

	if(layer === 0){
		// Update invalidated map cache
		if(mapDirty){
			for(i=0; i<mapSizeX; i++){
				for(j=0; j<mapSizeY; j++){
					updateMapCacheCanvas(i,j);
				}
			}
			mapDirty = false;
		}
		for(i=0; i<mapSizeX; i++){
			for(j=0; j<mapSizeY; j++){
				if(mapDataDirty[j * mapSizeX + i]){
					updateMapCacheCanvas(i,j);
					mapDataDirty[j * mapSizeX + i] = 0;
				}
			}
		}

		var _sx = cel_x * cellsizeX; // Clip start
		var _sy = cel_y * cellsizeY;
		var _x = sx; // Draw position
		var _y = sy;
		var _swidth = cel_w * cellsizeX; // Clip end
		var _sheight = cel_h * cellsizeY;
		var _width = _swidth; // Width on target canvas
		var _height = _sheight;
		ctx.drawImage(mapCacheCanvas,_sx,_sy,_swidth,_sheight,_x,_y,_width,_height);
	} else {
		// Draw only matching sprites
		for(i=0; i<cel_w; i++){
			for(j=0; j<cel_h; j++){
				var spriteNumber = mget(i, j);
				var flags = fget(spriteNumber);
				if((layer & flags) === layer){
					spr(spriteNumber, sx + i * cellsizeX, sy + j * cellsizeY);
				}
			}
		}
	}
};

// Returns the sprite X position in the 16x16 spritesheet
function ssx(n){
	return n % 16;
}

// Returns the sprite Y position in the 16x16 spritesheet
function ssy(n){
	return Math.floor(n / 16) % (16 * 16);
}

exports.spr = function spr(n, x, y, w, h, flip_x, flip_y){
	pixelops.beforeChange();
	w = w !== undefined ? w : 1;
	h = h !== undefined ? h : 1;
	flip_x = flip_x !== undefined ? flip_x : false;
	flip_y = flip_y !== undefined ? flip_y : false;

	x = x | 0;
	y = y | 0;
	w = w | 0;
	h = h | 0;

	var sizex = cellsizeX * w;
	var sizey = cellsizeY * h;
	ctx.save();
	ctx.translate(
		x + (flip_x ? sizex : 0),
		y + (flip_y ? sizey : 0)
	);
	ctx.scale(flip_x ? -1 : 1, flip_y ? -1 : 1);
	ctx.drawImage(
		spriteSheetCanvas,
		ssx(n) * cellsizeX, ssy(n) * cellsizeY,
		sizex, sizey,
		0, 0,
		sizex, sizey
	);
	ctx.restore();
};

// Get sprite flags
exports.fget = function(n){
	return spriteFlags[n];
};

// Set sprite flags
exports.fset = function(n, flags){
	spriteFlags[n] = flags;
};

// Get pixel color
exports.pget = (function(){
	var data = new Uint8Array(3);
	return function(x, y){
		x = x | 0;
		y = y | 0;
		pixelops.pget(x,y,data);
		var col = utils.rgbToDec(data[0], data[1], data[2]);
		return palette.indexOf(col);
	};
})();

// Set pixel color
exports.pset = function(x, y, col){
	x = x | 0;
	y = y | 0;
	col = col | 0;

	// new style
	var dec = palette[col];
	var r = utils.decToR(dec);
	var g = utils.decToG(dec);
	var b = utils.decToB(dec);
	pixelops.pset(x,y,r,g,b);
};

// Get spritesheet pixel color
var sgetData = null;
exports.sget = function(x, y){
	x = x | 0;
	y = y | 0;
	if(!sgetData){
		sgetData = spriteSheetContext.getImageData(0, 0, screensizeX, screensizeY).data;
	}
	var p = screensizeX * 4 * y + x * 4;
	var col = utils.rgbToDec(
		sgetData[p + 0],
		sgetData[p + 1],
		sgetData[p + 2]
	);
	return palette.indexOf(col);
};

// Set spritesheet pixel color
exports.sset = function(x, y, col){
	x = x | 0;
	y = y | 0;
	col = col !== undefined ? col : defaultColor;
	if(transparentColors[col]){
		spriteSheetContext.clearRect(x, y, 1, 1);
	} else {
		spriteSheetContext.fillStyle = paletteHex[col % palette.length];
		spriteSheetContext.fillRect(x, y, 1, 1);
	}
	mapDirty = true; // TODO: Only invalidate matching map positions
	sgetData = null;
};

exports.fullscreen = function fullscreen(){
	utils.fullscreen(container);
};

exports.print = function(text, x, y, col){
	pixelops.beforeChange();
	if(Array.isArray(text)){
		for(var i=0; i<text.length; i++){
			exports.print(text[i], x, y + 8*i, col);
		}
		return;
	}
	x = x !== undefined ? x : 0;
	y = y !== undefined ? y : 0;
	col = col !== undefined ? col : defaultColor;

	x = x | 0;
	y = y | 0;

	font.draw(ctx, text.toUpperCase(), x, y, col);
};

exports.fit = function fit(){
	var i = canvases.length;
	while(i--){
		utils.scaleToFit(canvases[i], container, true);
	}
};

exports.mget = function mget(x, y){
	x = x | 0;
	y = y | 0;
	return mapData[y * mapSizeX + x];
};

exports.mset = function mset(x, y, i){
	if(mget(x,y) === i) return;

	x = x | 0;
	y = y | 0;

	mapData[y * mapSizeX + x] = i;
	mapDataDirty[y * mapSizeX + x] = 1;
};

exports.save = function(key){
	key = key || 'save';
	var data = toJSON();

	var idx = key.indexOf('.json');
	if(idx !== -1){
		download(key.substr(0,idx));
	} else {
		localStorage.setItem(key, JSON.stringify(data));
	}
};

exports.load = function(key){
	key = key || 'save';
	if(key.indexOf('.json') !== -1){
		loadJsonFromUrl(key,function(err,json){
			if(json){
				loadJSON(json);
			}
		});
	} else {
		try {
			var data = JSON.parse(localStorage.getItem(key));
			loadJSON(data);
			return true;
		} catch(err) {
			return false;
		}
	}
};

function loadJsonFromUrl(url, callback){
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                callback(null, JSON.parse(xhr.responseText));
            } else {
                callback(xhr);
            }
        }
    };
    xhr.open("GET", url, true);
    xhr.send();
}


exports.codeset = function(codeString){
	code = codeString;
};

exports.codeget = function(){
	return code;
};

function download(key){
	key = key || 'export';
	var data = toJSON();
	var url = URL.createObjectURL(new Blob([JSON.stringify(data)]));
	var a = document.createElement('a');
	a.href = url;
	a.download = key + '.json';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function toJSON(){
	var data = {
		version: 4,
		width: screensizeX, // added in v3
		height: screensizeY, // added in v3
		cellwidth: cellwidth(), // added in v4
		cellheight: cellheight(), // added in v4
		map: [],
		sprites: [],
		flags: [],
		palette: palette.slice(0),
		sfx: [],
		code: codeget() // added in v2
	};
	for(var i=0; i<spriteFlags.length; i++){
		data.flags[i] = fget(i);
	}
	for(var i=0; i<spriteSheetSizeX*cellwidth(); i++){
		for(var j=0; j<spriteSheetSizeY*cellheight(); j++){
			data.sprites[j*spriteSheetSizeX*cellwidth()+i] = sget(i,j);
		}
	}
	for(var i=0; i<mapSizeX; i++){
		for(var j=0; j<mapSizeY; j++){
			data.map[j*mapSizeX+i] = mget(i,j);
		}
	}

	for(var n=0; n<64; n++){
		data.sfx[n] = {
			speed: asget(n),
			volumes: [],
			pitches: [],
			waves: []
		};
		for(var offset=0; offset<32; offset++){
			data.sfx[n].volumes.push(avget(n, offset));
			data.sfx[n].pitches.push(afget(n, offset));
			data.sfx[n].waves.push(awget(n, offset));
		}
	}

	return data;
}

function loadJSON(data){
	codeset(data.code || '');

	if(data.width !== undefined){
		width(data.width);
	}
	if(data.height !== undefined){
		height(data.height);
	}

	if(data.cellwidth !== undefined){
		cellwidth(data.cellwidth);
	}
	if(data.cellheight !== undefined){
		cellheight(data.cellheight);
	}

	for(var i=0; i<spriteFlags.length; i++){
		fset(i, data.flags[i]);
	}
	for(var i=0; i<spriteSheetSizeX*cellwidth(); i++){
		for(var j=0; j<spriteSheetSizeY*cellheight(); j++){
			sset(i,j,data.sprites[j*spriteSheetSizeX*cellwidth()+i]);
		}
	}
	for(var i=0; i<mapSizeX; i++){
		for(var j=0; j<mapSizeY; j++){
			mset(i,j,data.map[j*mapSizeX+i]);
		}
	}
	setPalette(data.palette);

	for(var n=0; n<data.sfx.length; n++){
		asset(n, data.sfx[n].speed);
		for(var offset=0; offset<data.sfx[n].volumes.length; offset++){
			avset(n, offset, data.sfx[n].volumes[offset]);
			afset(n, offset, data.sfx[n].pitches[offset]);
			awset(n, offset, data.sfx[n].waves[offset]);
		}
	}
};

exports.loadjson = loadJSON;

function updateMapCacheCanvas(x,y){
	var n = mget(x, y);
	mapCacheContext.clearRect(x * cellsizeX, y * cellsizeY, cellsizeX, cellsizeY);
	mapCacheContext.drawImage(
		spriteSheetCanvas,
		ssx(n) * cellsizeX, ssy(n) * cellsizeY,
		cellsizeX, cellsizeY,
		cellsizeX * x, cellsizeY * y,
		cellsizeX, cellsizeY
	);
}

exports.help = function(){
	help.print();
};

exports.mousex = function(){
	return Math.floor(input.mousexNormalized() * screensizeX);
};

exports.mousey = function(){
	return Math.floor(input.mouseyNormalized() * screensizeY);
};

utils.makeGlobal(math);
utils.makeGlobal(sfx);
utils.makeGlobal(exports);
utils.makeGlobal(input.global);

help.hello();
help.print();