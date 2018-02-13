
/*
    GeoMap
    ========================

    @file      : GeoMap.js
    @version   : 2.0
    @author    : Ivo Sturm
    @date      : 13-2-2017
    @copyright : First Consulting
    @license   : Apache V2

    Documentation
    ========================
    With this widget it is possible to show a GeoMap from Google on your webpage.
	
	v2.0: upgrade to Mendix 7
	
*/
// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
	"dojo/NodeList-traverse",
    "mxui/widget/_WidgetBase",
	'dijit/_TemplatedMixin',
	"mxui/dom",
	"dojo/dom-style",
	"dijit/registry",
	"dojo/on",
	"GeoMap/lib/jsapi",
	'dojo/text!GeoMap/widget/template/GeoMap.html'
], function(declare, NodeList, _WidgetBase, _TemplatedMixin, dom, domStyle, registry,on,GeoMap,widgetTemplate) {
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
		widgetLogNode		: "GeoChart widget:",

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

			if (!google.visualization){
				if (this.enableLogging){
					console.log('visualization library not loaded yet -> loading..');
				}
                var params = null;
				if (this.apiAccessKey !== "") {
					params = "key=" + this.apiAccessKey  + "&sensor=false";
				} else {
					params = "sensor=false";
				}
				
				google.load('visualization', '1.0', 
				{ packages: ['corechart', 'bar', 'table'], mapsApiKey : this.apiAccessKey,  callback: dojo.hitch(this,function(){ this.drawChart(callback) })});

            } else {
				if (this.enableLogging){
					console.log('visualization library already loaded -> reload map');
                }
				this.drawChart(callback);
                 
            }			

		},  
		drawChart : function (callback) {
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
			
			this._executeCallback(callback);
						
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
				console.log(this.widgetLogNode + " Objects retrieved: ");
				console.dir(this._objects);
			}
			if (this._objects.length > 0) {
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
								console.log(this.widgetLogNode + " On Click Microflow " + this.onClickMicroflow + " succesfully triggeded !");
							}
						}),
						error: function(error) {
							console.log(this.widgetLogNode + error.description);
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
					console.log(this.widgetLogNode + " data: ");
					console.dir(data);
					console.log(this.widgetLogNode + " options: ");
					console.dir(this.options);
				}
								
				this.geoMap.draw(data, this.options);
					
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
								console.log(this.widgetLogNode + " Update on entity " + entity);
							}
							this.drawChart();
					})
				});
				this._handles.push(contextHandle);
			}
            
        },
		_executeCallback: function (cb) {
            if (cb && typeof cb === "function") {
                cb();
            }
        },
		uninitialize : function(){
						
		}
    });
});

require(["GeoMap/widget/GeoMap"], function() {
    "use strict";
});
