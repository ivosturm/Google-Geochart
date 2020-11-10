
/*
    GeoMap
    ========================

    @file      : GeoMap.js
    @version   : 2.1
    @author    : Ivo Sturm
    @date      : 10-11-2020
    @copyright : First Consulting
    @license   : Apache V2

    Documentation
    ========================
    With this widget it is possible to show a GeoMap from Google on your webpage.
	
	v2.0: upgrade to Mendix 7
	v2.1: - upgraded to Mendix 8
		  - moved to new loading of Google Charts via loader library
		  - clean up code
	
*/
// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
	'dijit/_TemplatedMixin',
	"mxui/dom",
	"dojo/dom-style",
	"dijit/registry",
	"dojo/on",
	"GeoMap/lib/loader",
	'dojo/text!GeoMap/widget/template/GeoMap.html'
], function(declare, _WidgetBase, _TemplatedMixin, dom, domStyle, registry,on,GeoMap,widgetTemplate) {
    'use strict';

    // Declare widget's prototype.
    return declare("GeoMap.widget.GeoMap", [ _WidgetBase, _TemplatedMixin ], {
        templateString: widgetTemplate,
		
		apiAccessKey		: '',
		mapEntity			: '',
		xpathConstraint		: '',
		mapHeight			: 0,
		mapWidth			: '',
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
		_logNode		: "GeoChart widget:",


		// dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {

            //logger.debug(this.id + ".constructor");
        },	
		postCreate : function() {
			this._handles = [];
			this.schema = [];
			this.refs = [];
			this.splits = {};
			this._objects = [];
			this.domNode.style.width = this.mapWidth + 'px';
			this.domNode.style.height = this.mapHeight + 'px';		
			this.domNode.style.border = this.mapBorderRadius + 'px solid' + this.mapBorderColor;
						
			dojo.addClass(this.domNode, 'geoChartWidget');


								
		},
		update : function(obj, callback){
			
			this._contextObj = obj;
			this._resetSubscriptions();	

			if (this.apiAccessKey && this.apiAccessKey !== "") {		
				if (!google) {
					console.warn("Google library is not loaded!");
					return;
				}

				if (!google.visualization) {
					if (!window._googleVisualizationLoading) {
						window._googleVisualizationLoading = true;
						google.charts.load('current', {
							'packages':['geochart'],
							// Note: you will need to get a mapsApiKey for your project.
							// See: https://developers.google.com/chart/interactive/docs/basic_load_libs#load-settings
							'mapsApiKey': this.apiAccessKey
							});
						google.charts.setOnLoadCallback(dojo.hitch(this, function() {
							window._googleVisualizationLoading = false;
							this.drawChart(callback);
						}));
					} else {
						this._waitForGoogleLoad(callback);
					}
				} else {
					this.drawChart(callback);
				}
			}  else {
				var message = " Google Geochart needs an active API key to work!";
				console.error(this._logNode + message);
				alert(message);
			}	
		},  
		_waitForGoogleLoad: function(callback) {
            logger.debug(this.id + "._waitForGoogleLoad");
            var interval = null,
                i = 0,
                timeout = 5000; // We'll timeout if google is not loaded
            var intervalFunc = lang.hitch(this, function() {
                i++;
                if (i > timeout) {
                    logger.warn(this.id + "._waitForGoogleLoad: it seems Google is not loaded in the other widget. Quitting");
					this._executeCallback(callback);
                    clearInterval(interval);
                }
                if (!window._googleVisualizationLoading) {
                    this.drawChart(callback);
                    clearInterval(interval);
                }
            });
            interval = setInterval(intervalFunc, 1);
		},
		_executeCallback: function(cb, from) {
            logger.debug(this.id + "._executeCallback" + (from ? " from " + from : ""));
            if (cb && typeof cb === "function") {
                cb();
            }
        },
		drawChart : function (callback) {

			if (window._googleVisualizationLoading) {
                this._waitForGoogleLoad(callback);
            } else {
			// Run this as soon as google charts is loaded.
			// Create map and its container.

				if (!this.geoMap) {

					this.geoMap = new google.visualization.GeoChart(this.geoMapContainer);	
									
				}
				
				if (this._contextObj){
					this._getObjects(this._contextObj.getGuid,callback);
				} else {
					this._getObjects(null,callback);
				}
			
			}	
						
		},	
		_getObjects : function(contextguid, callback) {
				
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
		
			if (this.schema.length === 0)
				this.schema.push('createdDate');
			
			this._objectsArray = [];
			if (this.enableLogging){
				console.log(this._lLogNode + " XPathString used to retrieve Objects: " + xpathString);

			}
			mx.data.get({
				xpath       : xpathString,
				filter      : {
					attributes  : this.schema,
					references	: this.refs
				},
				callback    : dojo.hitch(this, this._createGeoMap, callback),
				error       : dojo.hitch(this, function(err) {
					console.error(this._logNode + " Unable to retrieve data: " + err);
				})
			});

		},
		_loadSchema : function (attr, name) {
			if (attr) {
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
		_createGeoMap : function (callback,objectsArr) {
			
			this._objects = this._parseObjects(objectsArr);
			
			if (this.enableLogging){			
				console.dir(this._objects);
			}
			if (this.enableLogging){ 
				console.log(this._logNode + " Objects retrieved: ");
				console.dir(this._objects);
			}
			
			// Create the datatable
			
			var dataArray = [];
			for (var i = 0; i < this._objects.length; i++) {
				var dataObj = [];
				dataObj[0]= this._objects[i].country;
				dataObj[1]= parseInt(this._objects[i].number);

				dataArray.push(dataObj);		
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
							console.log(this._logNode + " On Click Microflow " + this.onClickMicroflow + " succesfully triggeded !");
						}
					}),
					error: function(error) {
						console.log(this._logNode + error.description);
					}
				}, this);
			}
			}));	
			
			var options = {
					displayMode:this.dataType,
					region: this.region, // selected region
					colorAxis: {
						colors: [this.colorAxisStart,  this.colorAxisEnd]
					},
					backgroundColor: this.backGroundColor,
					datalessRegionColor: '#FFFFFF',
					defaultColor: '#F6F6F6',
					tooltip: {textStyle: {color: this.toolTipColor}, showColorCode: true}
			};
			if (this.showLegend){
				options.legend =  {textStyle: {color: this.legendFontColor, fontSize: this.legendFontSize}};
			} else {
				options.legend = 'none';
			}
							
			this.options = options;
										
			if (this.enableLogging){
				console.log(this._logNode + " data: ");
				console.dir(data);
				console.log(this._logNode + " options: ");
				console.dir(this.options);
			}
							
			this.geoMap.draw(data, this.options);
					
			if (this._objects.length == 0)  {
				var message = " no country data found, can't load map!";
				console.warn(message);

			}

			this._executeCallback(callback);
		},
		_parseObjects : function (objs) {
			var newObjs = [];
			for (var i = 0; i < objs.length; i++) {
				var newObj = {};
				
				newObj.country = this._checkRef(objs[i], 'country', this.countryAttr);
				newObj.number = this._checkRef(objs[i], 'number', this.numberAttr);

				newObj.guid = objs[i].getGuid();
				
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
							console.log(this._logNode + " Update on entity " + entity);
						}
						this.drawChart();
				})
			});
			this._handles.push(entityHandle);
			
			if (this._contextObj){
				var contextEntity = this._contextObj.getTrackEntity();

				var contextHandle = mx.data.subscribe({
					entity: contextEntity,
					callback: dojo.hitch(this, function(entity) {
							if (this.enableLogging){
								console.log(this._logNode + " Update on entity " + entity);
							}
							this.drawChart();
					})
				});
				this._handles.push(contextHandle);
			}
            
        },
		uninitialize : function(){
						
		}
    });
});

require(["GeoMap/widget/GeoMap"], function() {
    "use strict";
});
