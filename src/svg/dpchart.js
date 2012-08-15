/*
 * SVG Chart Lib of Venus
 * */

;
(function (global, undefined) {
    /*
     * cache global.DPChart to _DPChart because DPChart will be redefined and later will mix back to DPChart
     * */
    var _DPChart = global.DPChart;

    var mix = _DPChart.mix
        , PI = Math.PI
        , isArray = _DPChart.isArray
        , isObject = _DPChart.isObject
        , charts = {} // charts added by using DPChart.addChart
        , getColor = _DPChart.getColors;

    /*DPChart Begin*/
    /*
     * Class DPChart
     * @param container{HTMLElement} container of the svg element to draw the chart
     * @param data{Array,Object} data can be array or object
     * @param options{object}
     */
    function DPChart(container, data, options) {
        if (!container || !container.nodeType) {
            return;
        }
        this.container = container;
        this.data = data || [];
        this.events = new _DPChart.CustomEvent();

        //default options
        var defaultOptions = {
            /*
             * width and height  equals the containers width and height by default
             * but when the container is invisible ,please parse the width and height manually
             * */
            width:container.clientWidth,
            height:container.clientHeight,
            /*
             * colors will be auto generated , but if you want you can parse an array
             * */
            colors:[],
            /*
             * axises usually are x and y .For detail see Class Axis
             * */
            axis:{
            },
            /*
             * grid under the chart has two config options:
             * enableRow
             * enableColumn
             * no grid by default
             * */
            grid:{
//                enableRow:true,
//                enableColumn:false
            }
        };
        this.options = mix(defaultOptions, options || {});
        this.stage = new Raphael(container, this.options.width, this.options.height);


        //init data
        this._initData();
        this.events.fire('onDataInit', this.series);

        this.colors = this.options.colors && this.options.colors.length ? this.options.colors : getColor(this.series.getSeries().length);

        // init axis
        this._initAxis();
        this.events.fire('onAxisInit', {});

        //init legend
        this._initLegend();
        this.events.fire('onLegendInit', this.legend);

        //init grid
        this._initGrid();
        this.events.fire('onGridInit', this.grid);

        // draw
        this.draw();

        //init events
        this._initEvents();

        this.events.fire('onFinish');

    }

    DPChart.prototype = {
        constructor:DPChart,
        _initData:function () {
            var data = this.data;
            this.series = new Series(data);
        },
        _initAxis:function () {
            var opt = this.options,
                axisOption = opt.axis,
                axises = {},
                axis,
                thisAxisOption,
                range,
                beginX,
                beginY

            for (axis in axisOption) {
                //init each axis in options.axis
                if ((thisAxisOption = axisOption[axis])) {
                    //set rotate 90 for y axis by default
                    (axis == 'y' && thisAxisOption.rotate == undefined) && (thisAxisOption.rotate = 90);
                    if (axis == "y" && (!thisAxisOption.ticks || thisAxisOption.ticks.length == 0)) {
                        //if y axis has no ticks , then auto generate ticks use series.getRange()
                        range = this.series.getRange();
                        if (thisAxisOption.max === undefined) {
                            thisAxisOption.max = range.max
                        }
                        if (thisAxisOption.min === undefined) {
                            thisAxisOption.min = range.min;
                        }
                    }
                    if (axis == "x") {
                        //set pop=1 for x Axis by default
                        (thisAxisOption.pop === undefined) && (thisAxisOption.pop = 1); //前面空一格
                        if (!thisAxisOption.ticks) {
                            //if x axis has no ticks , then auto generate ticks use series.getLabels()
                            //but getLabels() sometimes returns array of empty string depends on the data
                            thisAxisOption.ticks = this.series.getLabels();
                        }
                    }

                    thisAxisOption._svgWidth = this.options.width;
                    thisAxisOption._svgHeight = this.options.height;
                    axises[axis] = new Axis(thisAxisOption, this.series, this.stage);
                    //put the axis in middle by default
                    !thisAxisOption.beginX && axis == "x" && (beginX = (opt.width - axises[axis].axisLength) / 2);
                    !thisAxisOption.beginY && axis == "y" && (beginY = (opt.height - axises[axis].axisLength) / 2 + axises[axis].axisLength);
                }
            }
            if (beginX && beginY) {
                for (axis in axises) {
                    //adjust beginX and beginY
                    axises[axis].setPosition(beginX, beginY);
                }
            }
            this.axises = axises;
        },
        _initLegend:function () {
            /*
             * init legend
             * */

            var opt = this.options,
                legendOption = opt.legend;
            if (legendOption && this.series.getSeries().length) {
                legendOption._svgWidth = opt.width;
                legendOption._svgHeight = opt.height;
                legendOption.colors = this.colors;
                this.axises.x && this.axises.x.options.ticks && ( legendOption._ticks = this.axises.x.options.ticks);
                this.legend = new Legend(this.series, legendOption, this.stage);
            }
        },
        _initGrid:function () {
            var gridOption = this.options.grid
            //generate positions of  rows and columns
            gridOption.enableRow && this.axises.y && (gridOption.rows = this.axises.y.getTicksPos().y) && (gridOption._x = this.axises.y.beginX) && this.axises.x && (gridOption.width = this.axises.x.axisLength)
            gridOption.enableColumn && this.axises.x && (gridOption.columns = this.axises.x.getTicksPos().x) && (gridOption._y = this.axises.x.beginY) && this.axises.y && (gridOption.height = this.axises.y.axisLength)
            this.grid = new Grid(gridOption, this.stage);
        },
        _initEvents:function () {

        },
        draw:function () {
            for (var chart in charts) {
                if (this.options[chart]) {
                    //draw each chart in options , so you can put several type of charts in one svg
                    charts[chart].draw && charts[chart].draw.call(this, this.options[chart]);
                }
            }
        },
        update:function () {
            //TODO
        }
    };
    DPChart.addChart = function (name, methods) {
        charts[name] = methods;
    }
    DPChart.charts = charts;

    /*DPChart End*/

    var Series = function (data) {
        /*
         * init the series object which deal with the data
         * data can be Array or Object and format like :
         * [number,number,....] or [{},...] or [[number,..],..]
         * or {name:data,name:data,.....}
         *
         * all the above will be convert to
         * [{data:(number or array or object),name:(if has)},....]
         * and save as series property
         *
         * */
        var series = []
        if (isArray(data)) {
            data.forEach(function (d, i) {
                if (isArray(d)) {
                    series.push({data:d});
                }
                else if (isObject(d)) {
                    //item is {}
                    if (d.data !== undefined) {
                        // item in format {data:something,otherThings...}
                        series.push(d);
                    } else {
                        //item is data
                        series.push({data:d});
                    }
                } else {
                    series.push({data:d});
                }
            })
        } else if (isObject(data)) {
            for (var o in data) {
                series.push({
                    name:o,
                    data:data[o]
                });
            }
        } else {
            series.push({data:data});
        }
        this.series = series

    };
    Series.prototype = {
        constructor:Series,
        getRange:function () {
            /*
             * get the max and min value of data
             * return Object
             * {
             *     max:
             *     min:
             * }
             * */

            var max , min
            this.series.forEach(function (data) {
                //get the max and min value depends on the data format
                var d = data.data
                if (isArray(d)) {
                    var iMax = Math.max.apply(Math, d),
                        iMin = Math.min.apply(Math, d);
                    (max === undefined || iMax > max) && (max = iMax);
                    (min === undefined || iMin < min) && (min = iMin);
                } else if (isObject(d)) {
                    for (var o in d) {
                        (max === undefined || d[o] > max) && (max = d[o]);
                        (min === undefined || d[o] < min) && (min = d[o]);
                    }
                } else {
                    (max === undefined || d > max) && (max = d);
                    (min === undefined || d < min) && (min = d);
                }
            });

            return {
                max:max,
                min:min
            }
        },
        getSeries:function () {
            return this.series;
        },
        getLabels:function () {
            /*
             * return labels for auto generated x Axis
             * labels depends on the data
             * so sometimes labels will be array of empty string
             * */

            var labels = [],
                _labels = {},
                isObj = false,
                isArr = false,
                len = 0
            this.series.forEach(function (item) {
                if (item.name && _DPChart.isNumber(item.data)) {
                    //if there is 'name',then use the name
                    labels.push(item.name)
                }
                else {
                    var data = item.data;
                    if (isArray(data)) {
                        //if data is array ,that means got no labels
                        isArr = true;
                        len = Math.max(data.length, len)
                    }
                    else if (isObject(data)) {
                        for (var o in data) {
                            //cache the labels in the object _labels first , this will avoid duplicated labels
                            //and later will convert it to array
                            isObj = true;
                            _labels[o] = true;
                        }
                    } else {
                        labels.push('');
                    }
                }
            });
            if (isObj) {
                //convert _labels to array
                labels = [];
                for (var o in _labels) {
                    labels.push(o);
                }
            }
            if (isArr) {
                // data is Array ,create an array of empty string,length = len
                labels = new Array(len);
                // DON'T USE forEach , it won't work here
                for (var i = 0; i < len; i++) {
                    labels[i] = ''
                }
            }
            return labels;
        }
    }


    var Axis = function (options, series, paper) {
        var defaultOptions = {
                max:0,
                min:0,
                tickSize:1,         //tick size in value
                tickWidth:30,       //tick size in pixel
                ticks:[],           //ticks
                minorTickNum:0,     // won't work in this version ,TODO
                rotate:0,           //rotate 0-360 in counter-clockwise
                radius:0,           //axis could be circular but no in this version,TODO
                pop:0,              // empty ticks before
                _svgWidth:0,
                _svgHeight:0,
                labelRotate:0,      //rotate 0-360 of the labels in clockwise
                enable:true,        //visible or not
                fontSize:12         //label font size
            }
            , axisElement
            , labelElements = []
            , pathString = ""
            , beginX, beginY //start point of axis
            , opt = this.options = mix(defaultOptions, options)
            , i, l
            , labelMarginTop = 10
            , tickHeight = 3
            , rotate = 360 - opt.rotate
            , tick

        this.series = series;

        if (!opt.ticks.length) {
            //if got no ticks , auto generate ticks using min,mix ,tickSize
            tick = opt.min;
            while (tick < opt.max) {
                opt.ticks.push(tick)
                tick += opt.tickSize;
            }
            opt.ticks.push(tick)
        }

        //beginX,beginY ,can be adjust later
        this.beginX = beginX = opt.beginX || 30;
        this.beginY = beginY = opt.beginY || opt._svgHeight - 30;

        //use ticks to generate the DOM
        pathString += ("M" + beginX + " " + beginY);
        for (i = 0, l = opt.pop; i < l; i++) {
            pathString += ("h" + opt.tickWidth + "v" + tickHeight + "v" + -tickHeight);
        }
        for (i = 0, l = opt.ticks.length; i < l; i++) {
            //horizontal draw the axis and later rotate it
            if (i !== 0) {
                pathString += (  "h" + opt.tickWidth + "v" + tickHeight + "v" + -tickHeight );
            }
            labelElements[i] = paper.text((beginX + (i + opt.pop) * opt.tickWidth), beginY + labelMarginTop * (opt.rotate > 0 ? -1 : 1), opt.ticks[i]).rotate(rotate, beginX, beginY).attr({
                'font-size':opt.fontSize
            });
            if (opt.labelRotate) {
                var bbox = labelElements[i].getBBox()
                labelElements[i].rotate(opt.labelRotate).translate(bbox.width / 2, 0)
            }
        }

        //axis element of Raphael Path Element
        axisElement = this.axisElement = paper.path(pathString);
        this.labelElements = labelElements;
        if (!opt.enable) {
            //if invisible ,hide the elements
            //but the coordinate is actually exist
            axisElement.hide();
            labelElements.forEach(function (item) {
                item.hide();
            })
        }
        //rotate
        axisElement.rotate(rotate, beginX, beginY);

        //TODO compute 1 -1
        opt.rotate > 0 && axisElement.scale(1, -1, beginX, beginY);

        // length of the axis in pixel
        this.axisLength = opt.tickWidth * (opt.ticks.length + opt.pop - 1)
    };
    Axis.prototype = {
        constructor:Axis,
        getX:function (index) {
            //@param index{Number or String} index of the series or Name of labels
            //return the x in svg coordinate
            var opt = this.options
            if (typeof index == "string") {
                opt.ticks.forEach(function (tick, i) {
                    if (tick == index) {
                        index = i;
                    }
                })
            }
            return Math.cos(opt.rotate / 360 * 2 * PI) * (index + opt.pop) * opt.tickWidth + this.beginX;
        },
        getY:function (index, key) {
            //@param index{Number or String} index of the series or Name of labels
            //@param key{Number or String} index or key of data which is series[i].data
            //return the y in svg coordinate
            var opt = this.options
            if (key === undefined) {
                return this.beginY - Math.sin(opt.rotate / 360 * 2 * PI) * ( this.series.getSeries()[index].data - opt.ticks[0] - opt.pop) * opt.tickWidth / opt.tickSize;
            } else {
                return this.beginY - Math.sin(opt.rotate / 360 * 2 * PI) * ( this.series.getSeries()[index].data[key] - opt.ticks[0] - opt.pop) * opt.tickWidth / opt.tickSize;
            }
        },
        getOrigin:function () {
            //get the origin position in svg coordinate
            return {
                x:this.beginX,
                y:this.beginY
            }
        },
        getAngel:function () {
            //TODO
        },
        setPosition:function (x, y) {
            //set the origin position of the axis
            //transform the whole axis elements
            var left = x - this.beginX,
                top = y - this.beginY
            this.beginX = x;
            this.beginY = y;
            this.axisElement.transform('T' + left + ',' + top + "...");
            this.labelElements.forEach(function (label) {
                label.transform('T' + left + ',' + top + "...");
            });
        },
        getTicksPos:function () {
            /*each coordinate position of ticks
             * return {
             *     x:[],
             *     y:[]
             * }
             *
             * */
            var left = [],
                top = [],
                beginX = this.beginX,
                beginY = this.beginY,
                i, l,
                opt = this.options,
                rotate = opt.rotate / 360 * 2 * PI

            for (i = 0, l = opt.pop; i < l; i++) {
                left.push(beginX + i * opt.tickWidth * Math.cos(rotate));
                top.push(beginY + i * opt.tickWidth * Math.sin(rotate));
            }
            i > 0 && i--;
            this.options.ticks.forEach(function (tick, j) {
                left.push(beginX + (i + j) * opt.tickWidth * Math.cos(rotate));
                top.push(beginY - (i + j) * opt.tickWidth * Math.sin(rotate));
            });
            return {
                x:left,
                y:top
            }
        }
    }

    var Legend = function (series, options, paper) {
        /*
         * Class Legend
         * @param series{Series} instance of Series
         * @param options{Object}
         * @param paper{Raphael} instance of Raphael
         *
         * */
        var defaultOption = {
                position:['right', 'top'],      //position of the legend contains two elements (horizontal and vertical) each could be string and number
                format:'{name}',                //format of the texts
                fontSize:12,                    //text font size
                colors:[],                      //colors ,parsed as the dpchart.colors
                direction:'vertical',           //how to layout the items
                itemType:'rect'                 // or circle
            }, i, l
            , data = series.getSeries()
            , width = 15                        //item width
            , lineHeight = 20                   // item line height
            , span = 10                         //distance between item and text
            , border                            // rect element of border
            , startX = 0
            , startY = 0
            , item
            , text
            , textWidth
            , totalWidth = []
            , totalHeight = []
            , itemSet                           // set of items
            , textSet                           // set of texts
            , margin = 10                       // margin to svg boundary
            , padding = 10
            , names = []
            , colors
            , isVertical
            , labels = series.getLabels(),
            opt = this.options = mix(defaultOption, options);
        itemSet = paper.set();
        textSet = paper.set();
        colors = opt.colors;

        data.forEach(function (d, j) {
            if (d.name !== undefined) {
                names.push(d.name);
            } else if (_DPChart.isNumber(d.data)) {
                names.push(labels[j] || (options._ticks ? options._ticks[j] || '' : ""));
            } else {
                names.push('');
            }
        });
        isVertical = opt.direction == 'vertical';
        isVertical ? totalWidth = [] : totalWidth = 0;
        for (i = 0, l = data.length; i < l; i++) {
            //create the raphael elements
            var _x , _y;
            if (isVertical) {
                _x = startX + padding;
                _y = startY + padding + i * lineHeight;

            } else {
                _x = startX + padding;
                _y = startY + padding;
            }

            switch (opt.itemType) {
                case 'circle':
                    item = paper.circle(0, 0, width / 2).attr({
                        cx:_x,
                        cy:_y
                    });
                    break;
                case 'rect':
                    item = paper.rect(0, 0, width, width).attr({
                        x:_x,
                        y:_y
                    });
                    break;
            }
            text = isVertical ? paper.text(startX + width + span + padding, startY + padding + i * lineHeight + width / 2, names[i]) : paper.text(startX + width + span + padding, startY + padding + lineHeight / 2, names[i]).attr({
                'font-size':opt.fontSize
            })
            textWidth = text.getBBox().width;
            text.translate(textWidth / 2, 0);
            isVertical || (startX += (width + padding + span + textWidth))

            item.attr({
                'fill':colors[i],
                'stroke-width':0,
                'cursor':'pointer'
            });
            itemSet.push(item);
            textSet.push(text);
            isVertical ? totalWidth.push(textWidth) : totalWidth += textWidth;
        }
        totalWidth = isVertical ? Math.max.apply(Math, totalWidth) + width + span + padding * 2 : (width + span) * l + (l + 1) * padding + totalWidth;
        totalHeight = isVertical ? lineHeight * l + padding * 2 : padding * 2 + lineHeight;

        //border
        border = paper.rect(0, 0, totalWidth, totalHeight, 5).attr({
            'stroke-width':1,
            'stroke':'gray'
        });

        this.border = border;
        this.itemSet = itemSet;
        this.textSet = textSet;

        //transform to position
        var left , top;
        if (typeof (left = this.options.position[0]) == "string") {
            if (left == "right") {
                left = this.options._svgWidth - totalWidth - margin;
            } else if (left == "center") {
                left = this.options._svgWidth / 2 - totalWidth / 2
            } else {
                left = margin
            }
        }

        if (typeof (top = this.options.position[1]) == "string") {
            if (top == "bottom") {
                top = this.options._svgHeight - totalHeight - margin
            } else if (top == 'center') {
                top = this.options._svgHeight / 2 - totalHeight / 2
            } else {
                top = margin
            }
        }

        this.setPosition(left, top);


        //bind default click event
        this.on('click', (function () {
            var arr = new Array(data.length);
            return function (e, i) {
                if (arr[i] == true || arr[i] == undefined) {
                    arr[i] = false;
                    this.attr('fill', 'gray');
                } else {
                    arr[i] = true;
                    this.attr('fill', colors[i]);
                }
            }
        })());
    };
    Legend.prototype = {
        constructor:Legend,
        setPosition:function (left, top) {
            //set the position of the legend
            //relative ,not absolute
            this.itemSet.translate(left, top);
            this.textSet.translate(left, top);
            this.border.translate(left, top);
        },
        on:function (name, fn) {
            //bind DOM Events on legend item
            var event
            if ((event = this.itemSet[name] ) && typeof event == "function") {
                //has function such as click, mouseover
                this.itemSet.forEach(function (item, i) {
                    item[name](function (e) {
                        fn.call(item, e, i);
                    })
                })
            }
            return this;
        }
    }

    var Grid = function (options, paper) {
        var defaultOption = {
                'color':'#ccc', //color of the grid
                'rows':[], //coordinate
                'columns':[],
                'width':0, //length of the row
                'height':0, //length of the column
                'stroke-width':1,
                'opacity':0.2,
                _x:0, //x coordinate of y axis
                _y:0  //y coordinate of x axis ,these are used as the start position
            },
            options = this.options = mix(defaultOption, options)

        if (options.rows.length) {
            //draw rows
            options.rows.forEach(function (value) {
                paper.path('M' + options._x + "," + value + "h" + options.width).attr({
                    stroke:options.color,
                    "stroke-width":options['stroke-width'],
                    'opacity':options.opacity
                })
            })
        }
        if (options.columns.length) {
            //draw columns
            options.columns.forEach(function (value) {
                paper.path('M' + value + "," + options._y + "v" + -options.height).attr({
                    stroke:options.color,
                    "stroke-width":options['stroke-width'],
                    'opacity':options.opacity
                })
            })
        }

    }


    var toolTip = function (paper, x, y, texts, side) {
            //extend the Raphael Element and provide the toolTip Function
            //@param x , y position of the tip
            //@texts{Array or String} each line of text
            //@side{String} 'left','top','right' or 'bottom'
            var tip, labels,
                side = side || 'top',
                path = function (width, height, padding) {
                    var p = ['M', x, y],
                        arrowWidth = 5,
                        left, top

                    height += (2 * padding || 0);
                    width += (2 * padding || 0);
                    switch (side) {
                        case 'right':
                            //arrow at the left side and content at right
                            height = Math.max(arrowWidth * 2, height);
                            p.push('l', arrowWidth, -arrowWidth);
                            p.push('v', -(height / 2 - arrowWidth));
                            p.push('h', width);
                            p.push('v', height, 'h', -width);
                            p.push('v', -(height / 2 - arrowWidth));
                            p.push('l', -arrowWidth, -arrowWidth);
                            left = x + arrowWidth;
                            top = y - height / 2;
                            break;
                        case 'top':
                            width = Math.max(arrowWidth * 2, width);
                            p.push('l', -arrowWidth, -arrowWidth);
                            p.push('h', -(width / 2 - arrowWidth));
                            p.push('v', -height, 'h', width, 'v', height);
                            p.push('h', -(width / 2 - arrowWidth));
                            p.push('l', -arrowWidth, arrowWidth);
                            left = x - width / 2;
                            top = y - arrowWidth - height;
                            break;
                        case 'left':
                            height = Math.max(arrowWidth * 2, height);
                            p.push('l', -arrowWidth, arrowWidth);
                            p.push('v', height / 2 - arrowWidth);
                            p.push('h', -width, 'v', -height, 'h', width);
                            p.push('v', height / 2 - arrowWidth);
                            p.push('l', arrowWidth, arrowWidth);
                            left = x - arrowWidth - width;
                            top = y - height / 2;
                            break;
                        case 'bottom':
                            width = Math.max(arrowWidth * 2, width);
                            p.push('l', arrowWidth, arrowWidth);
                            p.push('h', width / 2 - arrowWidth);
                            p.push('v', height, 'h', -width, 'v', -height);
                            p.push('h', width / 2 - arrowWidth);
                            p.push('l', arrowWidth, -arrowWidth);
                            left = x - width / 2;
                            top = y + arrowWidth;
                            break;

                    }
                    p.push('z')
                    return {
                        path:p,
                        box:{
                            left:left,
                            top:top,
                            width:width,
                            height:height
                        }
                    };
                }

            !isArray(texts) && (texts = [texts]);
            if (this._dpchart_tooltip) {
                tip = this._dpchart_tooltip;
                labels = this._dpchart_tooltip_labels;
                texts.forEach(function (t, i) {
                    labels[i] ? labels[i].attr('text', t) : labels.push(paper.text(0, 0, t))
                })
            } else {
                labels = paper.set();
                var width = [], height = 0,
                    bBox,
                    text,
                    paddingToBorder = 10,
                    p


                texts.forEach(function (t, i) {
                    text = paper.text(x, -100, t)
                    labels.push(text);
                    bBox = text.getBBox();
                    text.attr({
                        'opacity':0,
                        'font-size':12
                    });
                    width.push(bBox.width);
                });
                labels.animate({'opacity':1}, 100);
                if (this._dpchart_tooltip_show)
                    return;
                p = path(Math.max.apply(Math, width), texts.length * bBox.height, paddingToBorder)
                this._dpchart_tooltip = tip = paper.path().attr({
                    path:p.path,
                    fill:"#000000",
                    "stroke-width":4,
                    "fill-opacity":.1,
                    'stroke-linejoin':'round',
                    'stroke':'#666',
                    'opacity':'0'
                }).animate({'opacity':1}, 100);
                labels.forEach(function (la, i) {
                    la.attr({
                        'y':p.box.top + (i + .5) * bBox.height + paddingToBorder,
                        'x':p.box.left + p.box.width / 2
                    })
                })
                this._dpchart_tooltip_labels = labels;
            }
            return toolTip;
        },
        toolTipHide = function () {
            var cb = function () {
                this.hide();
            }
            var animate = Raphael.animation({'opacity':0}, 100, 'linear', cb)
            this._dpchart_tooltip && (this._dpchart_tooltip.animate(animate) ) && (this._dpchart_tooltip_labels.animate(animate) ) && (this._dpchart_tooltip = false);
        }
    Raphael.el.toolTip = toolTip;
    Raphael.el.toolTipHide = toolTipHide;


    //add the Real DPChart to global
    global.DPChart = DPChart;
    //mix the properties back to DPChart
    mix(DPChart, _DPChart);

    //for unit test , temporary bind Classes on DPChart
    DPChart.Series = Series;
    DPChart.Axis = Axis;
    DPChart.Legend = Legend;
    DPChart.Grid = Grid;

})(this);