//global variables for data
var wellPts,
	cTracts,
	wellPtsArr = [],
	cTractsCentroidArr = [],
	intNitArr = [],
	intNitCancArr = [],
	observedNitCancArr = [];
//IDW input variable
var Weight = 2,
	binArea = 6;
//global variables for the turf feature collections
var tractsCentroids,
	censusTractsFeatures,
	wellsFeatureCol,
	regressionFeaturesHexbins,
	cancerGridPts,
	joinedFeatHexbins;
//layer groups
var tracts = L.layerGroup(),
	wells = L.layerGroup(),
	nitrateIDWLayerGroup = L.layerGroup(),
	joinedGroup = L.layerGroup(),
	regressionResidualsLayerGroup = L.layerGroup();
//establish baselayers
var light = L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/light-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoicHNteXRoMiIsImEiOiJjaXNmNGV0bGcwMG56MnludnhyN3Y5OHN4In0.xsZgj8hsNPzjb91F31-rYA', {
		id: 'mapbox.streets',
		attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>'
	}),
	dark = L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/dark-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoicHNteXRoMiIsImEiOiJjaXNmNGV0bGcwMG56MnludnhyN3Y5OHN4In0.xsZgj8hsNPzjb91F31-rYA', {
		id: 'mapbox.dark',
		attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>'
	}),
	esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
		id: 'esri.world',
		attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
	});
//setup baselayers for layer control
var baseMaps = {
	"Light Gray": light,
	"Dark Gray": dark,
	"Esri Topographic": esri
};
//setup overlays for layer control
var overlays = {
	"Census Tracts": tracts,
	"Wells": wells
};
//create map
var map = L.map('mapid', {
	center: [45, -89.5],
	zoom: 7,
	minZoom: 7,
	maxZoom: 18,
	layers: [light]
});
//create layer control
var layerList = L.control.layers(baseMaps, overlays, {
	collapsed: false //keep open at all times 
}).addTo(map);
//add title/header for context
$('<p class = "controlHeader">Basemap Tilesets</p>').insertBefore('div.leaflet-control-layers-base');
$('<p class = "controlHeader">Overlay Layers</p>').insertBefore('div.leaflet-control-layers-overlays');
//custom control for inputs
L.Control.submitControl = L.Control.extend({
	onAdd: function(map) {
		var content = L.DomUtil.create('div', 'leaflet-bar submit-Control');
		content.innerHTML = '<h1>Spatial Analysis of Nitrate and Cancer in Wisconsin</h1><p>Enter a cell size below in kilometers, and a distance-decay weight to interpolate the well sample data. The data are used to conduct a linear regression and show where there are underpredictions or overpredicitions of the cancer rates based on the analysis.</p><form id="calcForm">Interpolation Hexbin Size: <strong><span id="areaVal"></span></strong><br><input type="range" min="6" max="94" value="6" class="slider" id="binArea"><br>Distance Decay Weight: <strong><span id="decayVal"></span></strong><br><input type="range" min="2" max="100" value="2" class="slider" id="distDecay"></form><button id="calculate" class="startbtn" type="button" onclick="interpolateNitrateRates(Weight,binArea)">Calculate Surface</button>';
		//prevent map from moving when slider is in use
		$(content).on('mouseover dblclick', function() {
			L.DomEvent.disableClickPropagation(content);
		});
		return content;
	}
});
var printer = L.easyPrint({
	exportOnly: true,
	hidden: true
}).addTo(map);

function downloadMap() {
	printer.printMap('CurrentSize', 'downloadedmap')
}
//build upon submitcontrol to retrieve inputs from sliders and update the html
L.control.submitControl = function(opts) {
	return new L.Control.submitControl(opts);
}
L.control.submitControl({
	position: 'bottomright'
}).addTo(map);
var areaSlider = document.getElementById("binArea");
var areaVal = document.getElementById("areaVal");
areaVal.innerHTML = areaSlider.value + " KM";
areaSlider.oninput = function() {
	areaVal.innerHTML = this.value + " KM";
	binArea = parseInt(this.value);
}
var decaySlider = document.getElementById("distDecay");
var decayVal = document.getElementById("decayVal");
decayVal.innerHTML = decaySlider.value;
decaySlider.oninput = function() {
	decayVal.innerHTML = this.value;
	Weight = parseInt(this.value);
}
//import initial data layers (tracts and wells) style, draw, and add to map
$.getJSON("data/cancer_tracts.json", function(data) {
	cTracts = L.geoJson(data, {
		style: function(feature) {
			return {
				color: 'black',
				weight: 0.5,
				fillOpacity: 0.7,
				opacity: 0.7
			};
		}
	}).addTo(tracts);
	tracts.addTo(map);
	drawTracts();
	//nested data import for faster load times
	$.getJSON("data/well_nitrate.json", function(data) {
		wellPts = L.geoJSON(data, {
			pointToLayer: function(feature, latlng) {
				return L.circleMarker(latlng, {
					fillColor: 'black',
					fillOpacity: 1,
					color: 'black',
					weight: 0.25,
					opacity: 1,
					radius: 3
				});
			}
		}).addTo(wells);
		wells.addTo(map);
		drawWells();
		$('#loader').hide();
	});
});
//draw census tract data and build popups
function drawTracts() {
	var breaks = cancerRateBreaks(cTracts);
	cTracts.eachLayer(function(layer) {
		layer.setStyle({
			fillColor: cancerRateColorBreaks(layer.feature.properties.canrate, breaks)
		});
		var popup = "<b>Cancer Rate in Percent: </b>" + (layer.feature.properties.canrate * 100).toLocaleString() + "%";
		layer.bindPopup(popup);
	})
	//draw legend for the census tracts
	cancerRateLegend(breaks);
}
//draw wells data and build popups
function drawWells() {
	var breaks = nitrateBreaks(wellPts);
	wellPts.eachLayer(function(layer) {
		layer.setStyle({
			fillColor: nitrateColorBreaks(layer.feature.properties.nitr_ran, breaks)
		});
		var popup = "<b>Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm";
		layer.bindPopup(popup);
	});
	//draw legend for the well points
	nitrateRatesLegend(breaks, 'circle');
}
//get nitrate class breaks for the feature symbology
function nitrateBreaks(nitrateRatesInput) {
	var values = [];
	nitrateRatesInput.eachLayer(function(layer) {
		values.push(layer.feature.properties.nitr_ran);
	});
	//get 5 clusters clustered into groups of similar numbers
	var clusters = ss.ckmeans(values, 5);
	//2d array of the lowest and highest values (breaks) in each cluster
	var breaks = clusters.map(function(cluster) {
		return [cluster[0], cluster.pop()]; //cluster[0] = lowest value in cluser and cluster.pop() returns the last value in the array (highest value)
	});
	//return an array of class breaks
	return breaks;
}
//get cancer rate class breaks for the feature symbology
function cancerRateBreaks(cancerRateInput) {
	var values = [];
	cancerRateInput.eachLayer(function(layer) {
		values.push(layer.feature.properties.canrate);
	});
	//get 5 clusters clustered into groups of similar numbers
	var clusters = ss.ckmeans(values, 5);
	////2d array of the lowest and highest values (breaks) in each cluster
	var breaks = clusters.map(function(cluster) {
		return [cluster[0], cluster.pop()]; //cluster[0] = lowest value in cluser and cluster.pop() returns the last value in the array (highest value)
	});
	//return an array of class breaks
	return breaks;
}
//get nitrate colors from break ranges
function nitrateColorBreaks(dataVal, breaks) {
	return dataVal <= breaks[0][1] ? '#ffffb2' : dataVal <= breaks[1][1] ? '#fecc5c' : dataVal <= breaks[2][1] ? '#fd8d3c' : dataVal <= breaks[3][1] ? '#f03b20' : '#bd0026';
}
//get cancer rate colors from break ranges
function cancerRateColorBreaks(dataVal, breaks) {
	return dataVal <= breaks[0][1] ? '#f0f9e8' : dataVal <= breaks[1][1] ? '#bae4bc' : dataVal <= breaks[2][1] ? '#7bccc4' : dataVal <= breaks[3][1] ? '#43a2ca' : '#0868ac';
}
//create legend for nitrate concentrations  
function nitrateRatesLegend(breaks, styles) {
	var legend = L.control({
		position: 'bottomleft'
	});
	legend.onAdd = function() {
		var div = L.DomUtil.create('div', 'legend');
		div.innerHTML = "<h3><b>Nitrate Concentration<br>(Parts Per Million)</b></h3>";
		if (styles != 'square') { //square for hexbin legend
			for (var i = 0; i < breaks.length; i++) {
				div.innerHTML += '<span class="circle" style="background:' + nitrateColorBreaks(breaks[i][0], breaks) + '"></span> ' + '<label>' + parseFloat(breaks[i][0]).toFixed(2).toLocaleString() + ' - ' + parseFloat(breaks[i][1]).toFixed(2).toLocaleString() + ' ppm' + '</label>';
			}
		} else {
			for (var i = 0; i < breaks.length; i++) { //circle for point legend
				div.innerHTML += '<span class="square" style="background:' + nitrateColorBreaks(breaks[i][0], breaks) + '"></span> ' + '<label>' + parseFloat(breaks[i][0]).toFixed(2).toLocaleString() + ' - ' + parseFloat(breaks[i][1]).toFixed(2).toLocaleString() + ' ppm' + '</label>';
			}
		}
		return div;
	};
	legend.addTo(map);
}
//create legend for cancer rates by census tract  
function cancerRateLegend(breaks) {
	var legend = L.control({
		position: 'bottomleft'
	});
	legend.onAdd = function() {
		var div = L.DomUtil.create('div', 'legend');
		div.innerHTML = "<h3><b>Cancer Rate<br>(Percent per Census Tract)</b></h3>";
		for (var i = 0; i < breaks.length; i++) {
			div.innerHTML += '<span class="square" style="background:' + cancerRateColorBreaks(breaks[i][0], breaks) + '"></span> ' + '<label>' + parseFloat(breaks[i][0] * 100).toFixed(0).toLocaleString() + ' - ' + parseFloat(breaks[i][1] * 100).toFixed(0).toLocaleString() + '%' + '</label>';
		}
		return div;
	};
	legend.addTo(map);
}
//event listeners for overlay legends (only show legends for checked layers in layer control)
map.on('overlayadd', function(eventLayer) {
	if (eventLayer.name === 'Wells') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(1)').show();
	}
	if (eventLayer.name === 'Census Tracts') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(2)').show();
		cTracts.bringToBack();
	}
	if (eventLayer.name === 'Regression') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(1)').show();
	}
	if (eventLayer.name === 'Nitrate Concentration') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(3)').show();
	}
	if (eventLayer.name === 'Cancer Rate') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(2)').show();
	}
});
map.on('overlayremove', function(eventLayer) {
	if (eventLayer.name === 'Wells') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(1)').hide();
	}
	if (eventLayer.name === 'Census Tracts') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(2)').hide();
	}
	if (eventLayer.name === 'Regression') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(1)').hide();
	}
	if (eventLayer.name === 'Nitrate Concentration') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(3)').hide();
	}
	if (eventLayer.name === 'Cancer Rate') {
		$('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-left > div:nth-child(2)').hide();
	}
});
//highlight style options for hexbins
var hexStyleHighlight = {
	color: "rgba(0,0,0,0.5)", //stroke Color
	weight: 2, //stroke Weight
	opacity: 1, //border opacity
};
//attach styles and popups to the hex layer
function highlightHex(e) {
	var layer = e.target;
	layer.setStyle(hexStyleHighlight);
	if (!L.Browser.ie && !L.Browser.opera) {
		layer.bringToFront();
	}
}
//reset default styles
function resetHexHighlight(e) {
	var layer = e.target;
	var hexStyleDefault = styleHex(layer.feature);
	layer.setStyle(hexStyleDefault);
}
//default styles for all hexbins
function styleHex(feature) {
	return {
		color: 'grey', //stroke Color
		weight: 0.5, //stroke Weight
		fillOpacity: 0.6, //fill opacity
		opacity: 0.1 //border opacity
	};
}
//interpolate well points nitrate concentrations into a hexbin surface
function interpolateNitrateRates(Weight, hexbinArea) {
	$('#loader').show(); //unhide loader animation
	setTimeout(function() { //settimeout for the animation to draw before the heavy processing starts
		wellPts.eachLayer(function(layer) {
			wellPointsFeature = turf.point(layer.feature.geometry.coordinates, layer.feature.properties); //create a Turf point feature for the well point, with its coordinates and attributes
			wellPtsArr.push(wellPointsFeature);
		});
		wellsFeatureCol = turf.featureCollection(wellPtsArr); //create a Turf feature collection from the array of well point features
		nitrateRatesHexbinsTurf = turf.interpolate(wellsFeatureCol, hexbinArea, { //interpolate the well point features using the binArea, weight, and hexbin options using idw
			gridType: 'hex', //use points as the grid type, required to use the collect function
			property: 'nitr_ran', //interpolate values from the nitrate concentrations
			units: 'kilometers', //hexbin size in units
			weight: Weight // distance decay coefficient
		});
		for (var i in nitrateRatesHexbinsTurf.features) {
			var interpolatedNitrateRate = nitrateRatesHexbinsTurf.features[i].properties.nitr_ran; //get interpolated nitrate concentrations
			intNitArr.push(interpolatedNitrateRate);
		}
		nitrateRatesHexbins = L.geoJson(nitrateRatesHexbinsTurf, { //convert the hexbins to a geojson layer add to idw layer group
			style: styleHex //default styles for nitrate concentration hexbins
		}).addTo(nitrateIDWLayerGroup);
		var breaks = nitrateBreaks(nitrateRatesHexbins);
		nitrateRatesHexbins.eachLayer(function(layer) {
			layer.setStyle({
				fillColor: nitrateColorBreaks(layer.feature.properties.nitr_ran, nitrateBreaks(nitrateRatesHexbins))
			});
			var popup = "<b>Interpolated Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm";
			layer.bindPopup(popup, {
				className: 'my-popup',
				closeButton: false
			});
			//hovering options
			layer.on({
				mouseover: highlightHex,
				mouseout: resetHexHighlight
			});
			layer.on('mouseover', function(e) {
				this.openPopup();
			});
			layer.on('mouseout', function(e) {
				this.closePopup();
			});
		});
		layerList.addOverlay(nitrateIDWLayerGroup, "Nitrate Concentration");
		//create legend for the nitrate concentration hexbins
		nitrateRatesLegend(breaks, 'square');
		joinNitrateCancerValue(Weight, hexbinArea); //call cancer rate interpolation function
	}, 10);
}
//interpolate cancer rates from census tract centroids to gridpoints, join the cancer rates to the nitrate concentration hexbins
function joinNitrateCancerValue(Weight, hexbinArea) {
	cTracts.eachLayer(function(layer) {
		censusTractsFeatures = turf.polygon(layer.feature.geometry.coordinates, layer.feature.properties); //create a Turf polygon feature for the census tracts, with its coordinates and properties
		var censusTractsCentroidFeature = turf.centroid(censusTractsFeatures, layer.feature.properties); //grab centroid of the census tract and add layer properties to new feature
		cTractsCentroidArr.push(censusTractsCentroidFeature);
	});
	tractsCentroids = turf.featureCollection(cTractsCentroidArr); //create a Turf feature collection from the array of census tract centroid features
	cancerGridPts = turf.interpolate(tractsCentroids, hexbinArea, { //interpolate the cancer rate centroids using the binArea, weight, and hexbin options
		gridType: 'point', //use points as the grid type, required to use the collect function
		property: 'canrate', //interpolate values from the cancer rates
		units: 'kilometers', //hexbin size units
		weight: Weight // distance decay coefficient
	});
	joinedFeatHexbins = turf.collect(nitrateRatesHexbinsTurf, cancerGridPts, 'canrate', 'values'); //use the collect function to join the cancer rates to the nitrate concentration 'turf.collect' builds an array of cancer rates for features within the nitraterates hexbin output as 'values'
	for (var i in joinedFeatHexbins.features) {
		var canrateArray = joinedFeatHexbins.features[i].properties.values;
		var canrateArraySum = 0;
		for (var j in canrateArray) {
			if (canrateArray.length > 0) {
				canrateArraySum += parseFloat(canrateArray[j]); //get sum of the values for the average
			}
		}
		var canrateArrayAvg = canrateArraySum / canrateArray.length; //average cancer rate
		if (canrateArrayAvg != undefined) {
			joinedFeatHexbins.features[i].properties.canrate = canrateArrayAvg; //add average cancer rate to the canrate property of the nitraterates hexbin
		} else {
			joinedFeatHexbins.features[i].properties.canrate = "";
		}
	}
	joinedFeaturesHexbins = L.geoJson(joinedFeatHexbins, { //convert the hexbins to a geojson layer add to joined layer group
		style: styleHex //default styles for cancer rate hexbins
	}).addTo(joinedGroup);
	var breaks = cancerRateBreaks(joinedFeaturesHexbins);
	joinedFeaturesHexbins.eachLayer(function(layer) {
		layer.setStyle({
			fillColor: cancerRateColorBreaks(layer.feature.properties.canrate, breaks)
		});
		var popup = "<b>Interpolated Cancer Rate: </b>" + (layer.feature.properties.canrate * 100).toFixed(2).toLocaleString() + "%";
		layer.bindPopup(popup, {
			className: 'my-popup',
			closeButton: false
		});
		//hovering setup
		layer.on({
			mouseover: highlightHex,
			mouseout: resetHexHighlight
		});
		layer.on('mouseover', function(e) {
			this.openPopup();
		});
		layer.on('mouseout', function(e) {
			this.closePopup();
		});
	});
	layerList.addOverlay(joinedGroup, "Cancer Rate");
	//create legend for the cancer rate hexbins
	cancerRateLegend(breaks);
	calculateLinearRegression(joinedFeatHexbins); //call linear regression function passing the joined hexbins
}
//calculate the linear regression on the interpolated nitrate concentrations and cancer rates
function calculateLinearRegression(joinedFeaturesHexbinsTurf) {
	for (var i in joinedFeaturesHexbinsTurf.features) {
		var interpolatedNitrateConcentration = joinedFeaturesHexbinsTurf.features[i].properties.nitr_ran;
		var interpolatedCancerRate = joinedFeaturesHexbinsTurf.features[i].properties.canrate;
		intNitCancArr.push([parseFloat(interpolatedNitrateConcentration), parseFloat(interpolatedCancerRate)]); //2d array x is the nitrate concentrations(independent var) and y is the cancer rates(dependent var)
	}
	var regression = ss.linearRegression(intNitCancArr); //return the slope and intercept of the linear regression line
	var m = regression.m; //slope
	var b = regression.b; //y-intercept
	for (var j in joinedFeaturesHexbinsTurf.features) {
		var predictedCancerRate = m * (parseFloat(joinedFeaturesHexbinsTurf.features[j].properties.nitr_ran)) + b; //calculate the predicted cancer rate from the interpolated nitrate concentration y = mx+b
		var residual = joinedFeaturesHexbinsTurf.features[j].properties.canrate - predictedCancerRate; //observed - predicted values
		joinedFeaturesHexbinsTurf.features[j].properties.predictedCancerRate = predictedCancerRate; //add predicted cancer rate and residual to the hexbin properties
		joinedFeaturesHexbinsTurf.features[j].properties.residual = residual;
		var observedNitrateAndcancerRatePair = [joinedFeaturesHexbinsTurf.features[j].properties.nitr_ran, joinedFeaturesHexbinsTurf.features[j].properties.canrate]; //array of the observed nitrate concentrations and cancer rates
		observedNitCancArr.push(observedNitrateAndcancerRatePair);
	}
	//calculate the r-squared for the regression
	var regressionLine = ss.linearRegressionLine(regression); //create regression line
	var rSquared = parseFloat(ss.rSquared(observedNitCancArr, regressionLine)).toFixed(5); //calculate the r-squared
	//convert the hexbins to a geojson layer add to the regression residuals layer group
	regressionFeaturesHexbins = L.geoJson(joinedFeaturesHexbinsTurf, {
		style: styleHex //default style for the regression hexbins
	}).addTo(regressionResidualsLayerGroup);
	var breaks = regressionBreaks(regressionFeaturesHexbins);
	regressionFeaturesHexbins.eachLayer(function(layer) {
		layer.setStyle({
			fillColor: regressionColorBreaks(layer.feature.properties.residual, breaks)
		});
		var popup = "<b>Interpolated Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm" + "<br/>" + "<b>Observed Cancer Rate: </b>" + (layer.feature.properties.canrate * 100).toFixed(2).toLocaleString() + "% of census tract population" + "<br/>" + "<b>Predicted Cancer Rate: </b>" + (layer.feature.properties.predictedCancerRate * 100).toFixed(2).toLocaleString() + "% of census tract population" + "<br/>" + "<b>Residual: </b>" + (layer.feature.properties.residual).toLocaleString();
		layer.bindPopup(popup, {
			className: 'my-popup',
			closeButton: false
		});
		//hovering options
		layer.on({
			mouseover: highlightHex,
			mouseout: resetHexHighlight
		});
		layer.on('mouseover', function(e) {
			this.openPopup();
		});
		layer.on('mouseout', function(e) {
			this.closePopup();
		});
	});
	//remove wells and tract layers to only show generated surface layers
	layerList.removeLayer(wells);
	layerList.removeLayer(tracts);
	map.removeLayer(wells);
	map.removeLayer(tracts);
	regressionResidualsLayerGroup.addTo(map); //add regression layer to map
	$('.legend').hide(); //hide inital layer legends
	layerList.addOverlay(regressionResidualsLayerGroup, "Regression");
	$("#calculate").hide(); //remove calculate button
	$("#distDecay").hide(); //remove slider
	$("#binArea").hide(); //remove slider
	$('<p>R<sup>2</sup>: <strong>' + rSquared + '</strong></p>').insertAfter('#calcForm'); //insert rsquared value
	$('<button id="downloadPage" class="downloadbtn" type="button" onclick="downloadMap()"><i class="fas fa-file-download"></i></button>').insertAfter('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-right > div.leaflet-bar.submit-Control.leaflet-control > p:nth-child(4)'); //insert export button
	$('<button id="resetPage" class="startbtn" type="button" onclick="location.reload()">Reset</button>').insertAfter('#mapid > div.leaflet-control-container > div.leaflet-bottom.leaflet-right > div.leaflet-bar.submit-Control.leaflet-control > p:nth-child(4)'); //insert reset button
	//create legend for the regression residuals
	drawRegressionResidualsLegend(breaks);
	$('#loader').hide();
}
//regression residual colors from break ranges
function regressionColorBreaks(dataVal, breaks) {
	return dataVal <= breaks[0] ? '#4575b4' : dataVal <= breaks[1] ? '#91bfdb' : dataVal <= breaks[2] ? '#e0f3f8' : dataVal <= breaks[3] ? '#ffffbf' : dataVal <= breaks[4] ? '#fee090' : dataVal <= breaks[5] ? '#fc8d59' : '#d73027';
}
//get regression residual colors from break ranges from standard deviation
function regressionBreaks(regressionFeaturesHexbins) {
	var values = [];
	regressionFeaturesHexbins.eachLayer(function(layer) {
		var value = layer.feature.properties.residual;
		values.push(value);
	});
	var standardDeviation = ss.sampleStandardDeviation(values);
	var breaks = [-2.5 * standardDeviation, -1.5 * standardDeviation, standardDeviation * -0.5, standardDeviation * 0.5, standardDeviation * 1.5, 2.5 * standardDeviation]; //array of break points for -2.5, -1.5, -0.5, 0.5  1.5, 2.5 standard deviations
	return breaks;
}
//create legend for regression residuals
function drawRegressionResidualsLegend(breaks) {
	var legend = L.control({
		position: 'bottomleft'
	});
	legend.onAdd = function() {
		var div = L.DomUtil.create('div', 'legend');
		div.innerHTML = "<h3><b>Standard Deviation of Residuals</b></h3>";
		div.innerHTML += '<span style="background:' + regressionColorBreaks(breaks[0], breaks) + '"></span> ' + '<label>< -2.5 Std. Dev. (Overprediction)</label>';
		div.innerHTML += '<span style="background:' + regressionColorBreaks(breaks[1], breaks) + '"></span> ' + '<label>-2.5 - -1.5 Std. Dev.</label>';
		div.innerHTML += '<span style="background:' + regressionColorBreaks(breaks[2], breaks) + '"></span> ' + '<label>-1.5 - -0.5 Std. Dev.</label>';
		div.innerHTML += '<span style="background:' + regressionColorBreaks(breaks[3], breaks) + '"></span> ' + '<label>-0.5 - 0.5 Std. Dev.</label>';
        div.innerHTML += '<span style="background:' + regressionColorBreaks(breaks[4], breaks) + '"></span> ' + '<label>0.5 - 1.5 Std. Dev.</label>';
        div.innerHTML += '<span style="background:' + regressionColorBreaks(breaks[5], breaks) + '"></span> ' + '<label>1.5 - 2.5 Std. Dev.</label>';
		div.innerHTML += '<span style="background:' + regressionColorBreaks(breaks[6], breaks) + '"></span> ' + '<label>> 2.5 Std. Dev. (Underprediction)</label>';
		return div;
	};
	legend.addTo(map);
}