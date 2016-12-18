exports.disableImageSmoothing = function(ctx) {
	if(ctx.imageSmoothingEnabled !== undefined){
		ctx.imageSmoothingEnabled = false;
	} else if(ctx.mozImageSmoothingEnabled !== undefined){
		ctx.mozImageSmoothingEnabled = false;
	} else if(ctx.webkitImageSmoothingEnabled !== undefined){
		ctx.webkitImageSmoothingEnabled = false;
	} else if(ctx.msImageSmoothingEnabled !== undefined){
		ctx.msImageSmoothingEnabled = false;
	}
};

exports.hexToRgb = function hexToRgb(hex) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return [
		parseInt(result[1], 16),
		parseInt(result[2], 16),
		parseInt(result[3], 16)
	];
};

exports.rgbToDec = function(r, g, b){
	var c = r * (256*256) + g * 256 + b;
	return c;
};

exports.decToR = function(c){
	return Math.floor(c / (256*256));
};

exports.decToG = function(c){
	return Math.floor(c / 256) % 256;
};

exports.decToB = function(c){
	return c % 256;
};

function isSafari(){
	return navigator.userAgent.indexOf('Safari') !== -1 && navigator.userAgent.indexOf('Chrome') === -1;
};

exports.makeGlobal = function(obj){
	for(var key in obj){
		window[key] = obj[key];
	}
};

exports.scaleToFit = function scaleToFit(element, containerElement, pixelPerfectMode){
	var containerWidth = window.innerWidth;
	var containerHeight = window.innerHeight;
	if(containerElement){
		var rect = containerElement.getBoundingClientRect();
		containerWidth = rect.width;
		containerHeight = rect.height;
	}
	var scaleX = containerWidth / element.width;
	var scaleY = containerHeight / element.height;
	var scale = Math.min(scaleX, scaleY);

	var dpr = window.devicePixelRatio || 1;

	if(pixelPerfectMode){
		scale = (Math.floor(scale * dpr)/dpr) || (1/dpr);
	}

	var offsetX = (containerWidth - element.width * scale) * 0.5;
	var offsetY = (containerHeight - element.height * scale) * 0.5;

	if(pixelPerfectMode){
		offsetX = Math.floor(offsetX * dpr) / dpr;
		offsetY = Math.floor(offsetY * dpr) / dpr;
	}

	// Safari doesn't have nearest neighbor rendering when using CSS3 scaling
	if (isSafari()){
		element.style.width = (element.width * scale) + "px";
		element.style.height = (element.height * scale) + "px";
		element.style.marginLeft = offsetX + 'px';
		element.style.marginTop = offsetY + 'px';
	} else {
		element.style.transformOrigin = "0 0"; //scale from top left
		element.style.transform = "translate(" + offsetX + "px, " + offsetY + "px) scale(" + scale + ")";
	}
};

exports.fullscreen = function(element) {
	if(document.fullscreenElement) return false;

	// Use the specification method before using prefixed versions
	if (element.requestFullscreen) {
		element.requestFullscreen();
	} else if (element.msRequestFullscreen) {
		element.msRequestFullscreen();
	} else if (element.mozRequestFullScreen) {
		element.mozRequestFullScreen();
	} else if (element.webkitRequestFullscreen) {
		element.webkitRequestFullscreen();
	} else {
		return false;
	}

	return true;
};

exports.zeros = function(n, reusableArray){
	if(reusableArray === undefined){
		var a = [];
		while(n--){
			a.push(0);
		}
		return a;
	} else {
		for(var i=0; i<reusableArray.length; i++){
			reusableArray[0] = 0;
		}
		while(reusableArray.length < n) reusableArray.push(0);
		return reusableArray;
	}
};

exports.createCanvas = function(w,h){
	var canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	return canvas;
}