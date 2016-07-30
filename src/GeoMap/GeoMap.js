
/*
    ImageMap
    ========================

    @file      : GeoMap.js
    @version   : 1.0
    @author    : Ivo Sturm
    @date      : 30-06-2016
    @copyright : First Consulting
    @license   : {{license}}

    Documentation
    ========================
    With this widget it is possible to show a GeoMap from Google on your webpage.
	
*/
dojo.require("dijit.form.CheckBox");
// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
	"dojo/NodeList-traverse",
    "mxui/widget/_WidgetBase",
	"mxui/dom",
	"dojo/dom-style",
	"dijit/registry",
	"dojo/on"
], function(declare, NodeList, _WidgetBase, dom, domStyle, registry,on) {
    "use strict";

    // Declare widget's prototype.
    return declare("GeoMap.GeoMap", [ _WidgetBase ], {


		apiAccessKey		: '',
		mapEntity			: '',
		xpathConstraint		: '',
		mapHeight			: 0,
		mapWidth			: '',
		mapTypeEnum			: 'GeoChart',
		countryAttr			: '',
		numberAttr			: '',
		mapBorderColor		: '',
		mapBorderRadius		: '',
		showZoomOut 		: true,
		zoomOutLabel		: 'Zoom Out',
		showLegend			: true,
		overviewMapControl 	: false,
		legendName			: '',
		dataMode			: 'regions',
		region				: 'world',
		enableLogging		: false,
		onClickMicroflow	: '',
		backGroundColor		: '#D5E8EE',
		colorAxisStart		: '#00853f', 
		colorAxisEnd		: '#e31b23',
		toolTipColor		: '#FF0000',
		legendFontColor		: '#000000',
		legendFontSize		: 14,

	
		//Caches
        _handles			: [],
        _contextObj			: null,
		_objects 			: null,
		geoMap				: '',
		googleMapsLoaded	: false,
		schema              : null,
		refs 				: null,
		mapType				: 'GeoChart',
		widgetLogNode		: "GeoChart widget:",

		// dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {
			this._handles = [];
			this.schema = [];
			this.refs = [];
			this.splits = {};
			this._objects = [];
            //logger.debug(this.id + ".constructor");
        },	
		postCreate : function() {
			if (this.mapTypeEnum == 'GeoMap'){
				this.mapType = 'geomap';
			} else {
				this.mapType = 'geochart';
			}
			if (this.enableLogging){
				console.log(this.widgetLogNode + " maptype: " + this.mapType);
			}
			
			dojo.addClass(this.domNode, 'geoChartWidget');
			
			if (!window._googleLoading) {
				window._googleLoading = true;

				var googleAPILoad = mxui.dom.script({"src" : 'https://www.google.com/jsapi', "id" : 'GoogleLoadScript'});				
				document.getElementsByTagName("head")[0].appendChild(googleAPILoad);
				
				if (this.mapType == 'geochart'){
					var googlegGStaticLoad = mxui.dom.script({"src" : 'https://www.gstatic.com/charts/loader.js', "id" : 'GStaticLoadScript'});				
					document.getElementsByTagName("head")[0].appendChild(googlegGStaticLoad);				
				}
			}
			if (window._googleMapsCounter != null && window._googleMapsCounter > 0)
				++window._googleMapsCounter;
			else
				window._googleMapsCounter = 1;
			
			this._updateRendering();
		
		},
		update : function(obj, callback){
			
			this._contextObj = obj;
            this._resetSubscriptions();
			if (this._contextObj){
				this._updateRendering(this._contextObj.getGuid(),callback);
			} else {
				this._updateRendering();
			}			
			callback();
		},  
		loadGoogle : function(callback){

			// Are the scripts + map loaded?
			if(!window._googleMapLoaded || window._googleMapLoaded === false) {
				window._googleMapLoaded = true;
				mendix.lang.runOrDelay(dojo.hitch(this, function() {	// Run this as soon as the google object is available.
					if(this.apiAccessKey != ''){
						if (this.mapType == 'geomap'){
							google.load("visualization", "1", {'packages': this.mapType, 'other_params':"key=" + this.apiAccessKey + "&sensor=false", "callback" : dojo.hitch(this, this.drawMap, callback)});
						} else {
							google.charts.load('current', {'packages':['geochart']});
							google.charts.setOnLoadCallback(dojo.hitch(this, this.drawMap, callback));
						}
					} else {
						if (this.mapType == 'geomap'){
							google.load("visualization", "1", {'packages': this.mapType, 'other_params':"&sensor=false", "callback" : dojo.hitch(this, this.drawMap, callback)}); 		
						} else {
							google.charts.load('current', {'packages':['geochart']});
							google.charts.setOnLoadCallback(dojo.hitch(this, this.drawMap, callback));
						}
					}
				}),
				function () {
					return typeof google != "undefined";
				});
			} else {
				mendix.lang.runOrDelay(dojo.hitch(this, function() {
					this.drawMap(callback);
				}),
				function () {
					return typeof google != "undefined" && typeof google.maps != "undefined" && typeof google.maps.Map != "undefined" && google.charts != "undefined";
				});
			}
		},
		drawMap : function (callback) {
			// Run this as soon as google maps is loaded.
			// Create map and its container.

			if (!this.geoMap || this.geoMap == '') {
				
				var regionDiv = mxui.dom.div({'style' : 'height: '+this.mapHeight+'px; width: '+this.mapWidth+'px; border: 2px solid ' + this.mapBorderColor + '; border-radius: ' + this.mapBorderRadius + 'px;'});
				
				if (this.mapType == 'geomap'){				
					this.geoMap = new google.visualization.GeoMap(regionDiv);	
				} else {
					this.geoMap = new google.visualization.GeoChart(regionDiv);	
				}
				

				//loading finished.
				
				this.domNode.insertBefore(regionDiv,this.domNode.firstChild);
				this.googleMapsLoaded = true;
				
				callback && callback();
			} else {
				callback();
			}
			
		},	
		_updateRendering : function(contextguid, callback) {
			this.loadGoogle(dojo.hitch(this, function() {
				
				var xpathString = '';
				if (contextguid){
					xpathString = "//" + this.mapEntity + this.xpathConstraint.replace(/\[\%CurrentObject\%\]/gi, contextguid);
				}	
				else {
					xpathString = "//" + this.mapEntity + this.xpathConstraint;
				}
					
				this.schema = [];
				this.refs = {};
				
				this._loadSchema(this.countryAttr, 'country');
				this._loadSchema(this.numberAttr, 'number');
			
				if (this.schema.length == 0)
					this.schema.push('createdDate');
				
				this._objectsArray = [];
				if (this.enableLogging){
					console.log(this.widgetLogNode + " XPathString used to retrieve Objects: " + xpathString);

				}
				mx.data.get({
					xpath       : xpathString,
					filter      : {
						attributes  : this.schema,
						references	: this.refs
					},
					callback    : dojo.hitch(this, this._createGeoMap, callback),
					error       : dojo.hitch(this, function(err) {
						console.error(this.widgetLogNode + " Unable to retrieve data: " + err);
					})
				});
			}));
		},
		_loadSchema : function (attr, name) {
			if (attr != '') {
				this.splits[name] = attr.split("/");
				if (this.splits[name].length > 1)
					if (this.refs[this.splits[name][0]] && this.refs[this.splits[name][0]].attributes)
						this.refs[this.splits[name][0]].attributes.push(this.splits[name][2]);
					else
						this.refs[this.splits[name][0]] = {attributes : [this.splits[name][2]]};
				else
					this.schema.push(attr);
			}
		},
		_unsubscribe: function () {
          if (this._handles) {
			  for (var l=0 ; l<this._handles.length ; l++){
				mx.data.unsubscribe(this._handles[l]);
				this._handles[l] = null;
			  }

          }
        },
		_createGeoMap : function (callback, objectsArr) {
			this._objects = this._parseObjects(objectsArr);	
			if (this.enableLogging){ 
				console.log(this.widgetLogNode + " Objects retrieved: ");
				console.dir(this._objects);
			}
			if (this._objects.length > 0) {
				// Create the datatable
				
				var dataArray = [];
				for (var i = 0; i < this._objects.length; i++) {
					var data = [];
					data[0]= this._objects[i].country;
					data[1]= parseInt(this._objects[i].number);

					dataArray.push(data);		
				}
				var headerData = ['Country', this.legendName];
				dataArray.unshift(headerData);

				var data = this._loadData(dataArray);
				
				google.visualization.events.addListener(this.geoMap, 'select', dojo.hitch(this, function() {
				  var selection = this.geoMap.getSelection()[0];
				  var label = data.getValue(selection.row, 0);
				  var guid = 0;
				  for (var k=0 ; k < this._objects.length ; k++){
					 if (this._objects[k].country == label){
						guid = this._objects[k].guid;
					}
				  }

				  if (this.onClickMicroflow){
					mx.data.action({
						params: {
							applyto: "selection",
							actionname: this.onClickMicroflow,
							guids: [guid]
						},
						callback: dojo.hitch(this, function (result) {
							if (this.enableLogging){
								console.log(this.widgetLogNode + " On Click Microflow " + this.onClickMicroflow + " succesfully triggeded !");
							}
						}),
						error: function(error) {
							console.log(this.widgetLogNode + error.description);
						}
					}, this);
				}
				}));	
				
				var options = {};
				if (this.mapType == 'geochart'){
					options = {
					  displayMode:this.dataMode,
					  region: this.region, // selected region
					  colorAxis: {
						 colors: [this.colorAxisStart,  this.colorAxisEnd]
					  },
					  backgroundColor: this.backGroundColor,
					  datalessRegionColor: '#FFFFFF',
					  defaultColor: '#F6F6F6',
					  tooltip: {textStyle: {color: this.toolTipColor}, showColorCode: true}
					}
					if (this.showLegend){
						options.legend =  {textStyle: {color: this.legendFontColor, fontSize: this.legendFontSize}};
					}
				} else if (this.mapType == 'geomap'){
					options = {
						dataMode : this.dataMode,
						region : this.region,						
						showZoomOut : this.showZoomOut,
						showLegend : this.showLegend,
						zoomOutLabel : this.zoomOutLabel
					}
					
				}
								
				this.options = options;
				
				if (this.enableLogging){
					console.log(this.widgetLogNode + " data: ");
					console.dir(data);
					console.log(this.widgetLogNode + " options: ");
					console.dir(this.options);
				}
				
				
				
				
				this.geoMap.draw(data, this.options);
				
				if (callback && typeof(callback) == "function")
					callback();
					
			}
		},
		_parseObjects : function (objs) {
			var newObjs = [];
			for (var i = 0; i < objs.length; i++) {
				var newObj = {};
				
				newObj['country'] = this._checkRef(objs[i], 'country', this.countryAttr);
				newObj['number'] = this._checkRef(objs[i], 'number', this.numberAttr);

				newObj['guid'] = objs[i].getGuid();
				
				newObjs.push(newObj);
			}
			return newObjs;
		},
		_checkRef : function (obj, attr, nonRefAttr) {
			if (this.splits && this.splits[attr] && this.splits[attr].length > 1) {
				var subObj = obj.getChildren(this.splits[attr][0]);
				return (subObj.length > 0)?subObj[0].get(this.splits[attr][2]):'';
			} else
				return obj.get(nonRefAttr);
		},
		_loadData : function (dataArray) {	

			var data = google.visualization.arrayToDataTable(dataArray);	
			return data;
			
		},
		        // Reset subscriptions.
        _resetSubscriptions: function() {
            //logger.debug(this.id + "._resetSubscriptions");
            // Release handles on previous object, if any.
            this._unsubscribe();

			var entityHandle = mx.data.subscribe({
				entity: this.mapEntity,
				callback: dojo.hitch(this, function(entity) {
						if (this.enableLogging){
							console.log(this.widgetLogNode + " Update on entity " + entity);
						}
						this._updateRendering();
				})
			});
			this._handles.push(entityHandle);
			
			if (this._contextObj){
				var contextEntity = this._contextObj.getTrackEntity();

				var contextHandle = mx.data.subscribe({
					entity: contextEntity,
					callback: dojo.hitch(this, function(entity) {
							if (this.enableLogging){
								console.log(this.widgetLogNode + " Update on entity " + entity);
							}
							this._updateRendering();
					})
				});
				this._handles.push(contextHandle);
			}
            
        },
		uninitialize : function(){
						
			if (window._googleMapsCounter == null || --window._googleMapsCounter <= 0) {
				var googleScript = dojo.query('head #GoogleLoadScript')[0];
				googleScript && dojo.destroy(dojo.query('head #GoogleLoadScript')[0]);
				if (this.mapType == 'geochart'){
					var gStaticScript = dojo.query('head #GStaticLoadScript')[0];
					gStaticScript && dojo.destroy(dojo.query('head #GStaticLoadScript')[0]);
				}
				window._googleLoading == null;
			}
		}
    });
});

require(["GeoMap/GeoMap"], function() {
    "use strict";
});