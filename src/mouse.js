var math = require('./math');
var utils = require('./utils');

var _mousex = 0;
var _mousey = 0;
var _mousebtns = {};

exports.init = function(canvases){
	addListeners(canvases);
};

exports.mousex = function mousex(){ return _mousex; };
exports.mousey = function mousey(){ return _mousey; };

exports.mousebtn = function mousebtn(i){
	return !!_mousebtns[i];
};

function addListeners(canvases){
	canvasListeners = {
		click: function(evt){
			if(typeof(_click) !== 'undefined'){
				updateMouseCoords(evt, canvases);
				_mousebtns[evt.which] = true;
				_click();
				_mousebtns[evt.which] = false;
			}
		},
		mousedown: function(evt){
			_mousebtns[evt.which] = true;
			updateMouseCoords(evt, canvases);
		},
		mouseup: function(evt){
			_mousebtns[evt.which] = false;
			updateMouseCoords(evt, canvases);
		},
		mouseleave: function(evt){
			_mousebtns[evt.which] = false;
			updateMouseCoords(evt, canvases);
		}
	};
	for(var key in canvasListeners){
		canvases[0].addEventListener(key, canvasListeners[key]);
	}

	bodyListeners = {
		mousemove: function(evt){
			updateMouseCoords(evt, canvases);
		}
	};
	for(var key in bodyListeners){
		document.body.addEventListener(key, bodyListeners[key]);
	}
}

function removeListeners(canvases){
	var key;
	for(key in canvasListeners){
		canvases[0].removeEventListener(key, canvasListeners[key]);
	}
	for(key in bodyListeners){
		document.body.removeEventListener(key, bodyListeners[key]);
	}
}

function updateMouseCoords(evt, canvases){
	if(canvases.indexOf(evt.target) === -1) return;

	var rect = evt.target.getBoundingClientRect(); // cache this?
	var parentRect = evt.target.parentNode.getBoundingClientRect(); // cache this?
	var subx = 0;
	var suby = 0;
	_mousex = (evt.clientX - rect.left - subx) / rect.width;
	_mousey = (evt.clientY - rect.top - suby) / rect.height;
}

exports.mousexNormalized = function(){ return _mousex; };
exports.mouseyNormalized = function(){ return _mousey; };

exports.global = {
	mousebtn: exports.mousebtn,
	click: exports.click
};