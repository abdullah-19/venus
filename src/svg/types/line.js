;
(function (Chart, undefined) {
    /*
     * line chart
     *
     * */


    /*
     * function helps calculate the Bezier
     * */
    function getAnchors(p1x, p1y, p2x, p2y, p3x, p3y) {
        var l1 = (p2x - p1x) / 2,
            l2 = (p3x - p2x) / 2,
            a = Math.atan((p2x - p1x) / Math.abs(p2y - p1y)),
            b = Math.atan((p3x - p2x) / Math.abs(p2y - p3y));

        a = p1y < p2y ? Math.PI - a : a;
        b = p3y < p2y ? Math.PI - b : b;

        var alpha = Math.PI / 2 - ((a + b) % (Math.PI * 2)) / 2,
            dx1 = l1 * Math.sin(alpha + a),
            dy1 = l1 * Math.cos(alpha + a),
            dx2 = l2 * Math.sin(alpha + b),
            dy2 = l2 * Math.cos(alpha + b);

        return {
            x1:p2x - dx1,
            y1:p2y + dy1,
            x2:p2x + dx2,
            y2:p2y + dy2
        };
    }

    Chart.addChart('line', {
        draw:function () {
            var util = Venus.util,
             opt = this.options,
            /*
             * default options of DPChart.options.line
             * */
                lineOpt = util.mix({
                    'line-width':2,         //width of the line
                    smooth:false,           //straight line or curved line
                    dots:true,              //draw dot for each value or not
                    dotRadius:1,            //dot radius if dots enabled
                    area:false,             //draw area under the line or not
                    areaOpacity:0.1,        //area opacity if area enabled
                    beginAnimate:false,     //enable begin animate or not
                    dotSelect:true,         //enable dots select or not
                    columnHover:true        //enable column hover or not
                }, opt.line),
                dotRadius = lineOpt.dotRadius,
                series = this.series,
                data = series.getSeries(),
                self = this,
                raphael = this.stage,
                colors = this.colors,       //this.colors,
                elements = [],              //save the element by series
                dotsByXAxis = {},            //save the dots by x axis convenient for column hover
                coordinate = self.coordinate;


            function pointBindModel(x, y) {
                function set() {
                    var xy = coordinate.get(x, y);
                    point.x = xy.x;
                    point.y = xy.y;
                    point.xTick = xy.xTick;
                    point.yTick = xy.yTick;
                }
                var point = {};
                coordinate.y.on(set);
                set();
                return point;
            }

            /*
             * Main Function of draw a line
             * @param arr{Array or Object} array or object of the data of each point
             * @param indexOfSeries{Number} index of the Series
             * @color{Color}
             * @dotColor{Color}
             *
             * */
             function drawLine(arr, indexOfSeries, color, dotColor,label) {
                var points = []

                //put all points in the point array, ignore some missing points
                if (util.isArray(arr)) {
                    arr.forEach(function (d, i) {
                        var value, point;
                        if (util.isObject(d)) {
                            value = d.data;
                            label = self.labels[i];
                        } else {
                            value = d;
                        }
                        point =  pointBindModel(i,value);
                        point.label = label;
                        points.push(point);
                    });
                } else {
                    //arr is object
                    for (var o in arr) {
                        var point = pointBindModel(o,arr[o])
                        point.label = label;
                        points.push(point);
                    }
                }

                if (!points.length) {
                    //no point ,return
                    elements.push({});
                    return;
                }

                //sort by xAxis to avoid wrong order
                points.sort(function (a, b) {
                    return a.x - b.x;
                });
                var pathString,             //path string of the line
                    areaPathString,         //path string of the area
                    pathAnimateString,      //path string of the line animation
                    areaPathAnimateString;  //path string of the area animation

                //if points.length <=2 , draw straight line
                points.length <= 2 && (lineOpt.smooth = false);

                 function path() {
                     if (lineOpt.smooth) {
                         //draw smooth line
                         var x, y,
                             i, l,
                             x0, y0, x1, y1,
                             p;

                         //start point
                         pathString = [ 'M' , points[0].x , points[0].y, 'C', points[0].x, points[0].y];
                         areaPathString = ['M', points[0].x, coordinate.y.model.beginY, 'V', points[0].y, 'C', points[0].x, points[0].y];
                         lineOpt.beginAnimate && (pathAnimateString = ['M', points[0].x, coordinate.y.model.beginY]);
                         lineOpt.beginAnimate && (areaPathAnimateString = ['M', points[0].x, coordinate.y.model.beginY]);

                         for (i = 1, l = points.length - 1; i < l; i++) {
                             //calculate the path string use the current point , previous point and the next point
                             x0 = points[i - 1].x;
                             y0 = points[i - 1].y;
                             x = points[i].x;
                             y = points[i].y;
                             x1 = points[i + 1].x;
                             y1 = points[i + 1].y;
                             p = getAnchors(x0, y0, x, y, x1, y1);
                             pathString.push(p.x1, p.y1, x, y, p.x2, p.y2);
                             areaPathString.push(p.x1, p.y1, x, y, p.x2, p.y2);
                             lineOpt.beginAnimate && pathAnimateString.push('H', x) && areaPathAnimateString.push('H', x);
                         }
                         //push the last point
                         pathString.push(x1, y1, x1, y1);
                         areaPathString.push(x1, y1, x1, y1, 'V', coordinate.y.model.beginY, 'H', points[0].x, 'Z');
                         lineOpt.beginAnimate && pathAnimateString.push('H', x1);

                     } else {
                         //straight line and is simpler than the smooth line

                         //start point
                         pathString = ['M', points[0].x, points[0].y];
                         areaPathString = ['M', points[0].x, coordinate.y.beginY, 'V', points[0].y]
                         lineOpt.beginAnimate && (pathAnimateString = ['M', points[0].x, coordinate.y.model.beginY]);
                         lineOpt.beginAnimate && (areaPathAnimateString = ['M', points[0].x, coordinate.y.model.beginY]);

                         points.forEach(function (d) {
                             //push each point to the path string
                             pathString.push('L', d.x, d.y);
                             areaPathString.push('L', d.x, d.y);
                             lineOpt.beginAnimate && pathAnimateString.push('H', d.x);
                             lineOpt.beginAnimate && areaPathAnimateString.push('H', d.x);
                         });

                         //close the path of the area
                         areaPathString.push('V', coordinate.y.model.beginY, 'H', points[0].x, 'Z');
                     }
                 }

                 path();
                var line = raphael.path().attr({
                        'stroke-width':lineOpt['line-width'],
                        'stroke':color,
                        'path':pathAnimateString || pathString
                    }),
                    dots = raphael.set(),
                    area;

                if (lineOpt.beginAnimate) {
                    //begin animate
                    line.animate({'path':pathString}, 1000);
                }
                if (lineOpt.area) {
                    //draw area path
                    area = raphael.path().attr({
                        'stroke-width':0,
                        'path':areaPathAnimateString || areaPathString,
                        'fill':color,
                        'opacity':lineOpt.areaOpacity
                    });
                    if (lineOpt.beginAnimate) {
                        area.animate({'path':areaPathString}, 1000);
                    }
                }

                if (lineOpt.dots) {
                    //draw dots
                    points.forEach(function (d, i) {
                        var icon = self.iconFactory.create(indexOfSeries, d.x, d.y,dotRadius*2),
                        dot = icon.icon.attr({
                            'fill':dotColor || colors[i],
                            'stroke':'none'
                        }).hover(
                            //hover event which shows the toolTip and make the dot bigger
                            function () {
                                if (this._selected_) {
                                    return;
                                }
                                icon.animate({
                                    width: dotRadius * 4
                                }, 100);
                                this.toolTip(raphael, icon.position().x, icon.position().y - 10, self.options.tooltip.call(self,{
                                    x:d.xTick,
                                    y:d.yTick,
                                    label:d.label
                                }));
                            },
                            function () {
                                if (this._selected_) {
                                    return;
                                }
                                icon.animate({
                                    width: dotRadius *2
                                }, 100);
                                this.toolTipHide()
                            }).data('point', d);

                        dot._iconObj = icon;



                        if (lineOpt.beginAnimate) {
                            icon.position(icon.position().x, coordinate.y.model.beginY);
                            icon.animate({'y':d.y}, 1000);
                        }

                        if (lineOpt.dotSelect) {
                            //bind click event which shows the toolTip and make the dot bigger and cancel the effect when click again
                            dot.click(function () {
                                if (!this._selected_) {
                                    this.toolTip(raphael, icon.position().x, icon.position().y - 10, self.options.tooltip.call(self,{
                                        x:d.xTick,
                                        y:d.yTick,
                                        label:d.label
                                    }));
                                    this._selected_ = true;
                                } else {
                                    this._selected_ = false;
                                    this.toolTipHide();
                                }
                            })
                        }

                        //save the dots
                        dots.push(dot);
                        dotsByXAxis[d.x] || (dotsByXAxis[d.x] = raphael.set());
                        dotsByXAxis[d.x].push(dot);
                    });
                }

                //save the elements
                elements.push({line:line, dots:dots, area:area});

                //bind model
                 coordinate.y && coordinate.y.on(function () {
                     var duration = 500
                     path();
                     line.animate({
                         path:pathString
                     }, duration);
                     dots.forEach(function (dot, i) {
                         dot._iconObj.animate({
                             x:points[i].x,
                             y:points[i].y
                         }, duration);
                     });
                     area && area.animate({
                         path:areaPathString
                     }, duration);
                 });


            }

            function bindLegendEvents() {
                //bind legend click event which toggles the line hide
                self.legend && self.legend.onActiveChange(function(active,activeArray){
                    active.forEach(function (truth, i) {
                        if (truth) {
                            try {
                                elements[i].line.show();
                                elements[i].dots.show();
                                elements[i].area && elements[i].area.show();
                            } catch (e) {
                            }
                        } else {
                            try {
                                elements[i].line.hide();
                                elements[i].dots.hide();
                                elements[i].area && elements[i].area.hide();
                            } catch (e) {
                            }
                        }
                    });

                });
            }

            if (data[0]) {
                if (util.isNumber(data[0].data)) {
                    /*
                    * data is Number
                    * and draw totally one line
                    * */
                     drawLine(data, 0, this.colors[0], undefined);
                } else if (util.isArray(data[0].data)) {
                    /*
                    * data is array and series format as :
                    * [{data:[number,...]},...]
                    * draw a line for each item of the series
                    *
                    * */
                    data.forEach(function (item, i) {
                        //item is content of the data,draw a line
                        drawLine(item.data, i, colors[i], colors[i],self.labels[i]);
                    });
                    bindLegendEvents();

                } else if(util.isObject(data[0].data)) {
                    /*
                    * data is object and series format as :
                    * [{data:{key:value},...},...]
                    * draw a line for each item of the series
                    * */
                    data.forEach(function (item, i) {
                        // item is content of the data,draw a line
                        drawLine(item.data, i, colors[i], colors[i],self.labels[i]);
                    });
                    bindLegendEvents();

                }

                if (lineOpt.columnHover) {
                    //enable column hover event
                    for (var x in dotsByXAxis) {
                        //create an invisible rect and bind event on this rect
                        var width = coordinate.x.model.tickWidth,
                            height = coordinate.y.model.totalWidth;

                        //use closure to avoid bug : value is always the last x
                        (function (xValue) {
                            var set = dotsByXAxis[xValue];

                            raphael.rect(xValue - width / 2, coordinate.y.model.beginY - height, width, height).attr({
                                'stroke':'none', 'fill':'#fff', 'opacity':0
                            }).hover(
                                function () {
                                    set.forEach(function (d) {
                                        if (d._selected_) {
                                            return;
                                        }
                                        d._iconObj.animate({width:lineOpt.dotRadius * 4}, 100);
                                        d.node.style.display !== 'none' && (d.toolTip(raphael, d._iconObj.position().x, d._iconObj.position().y - 10, self.options.tooltip.call(self,{
                                            x:d.data('point').xTick,
                                            y:d.data('point').yTick,
                                            label:d.data('point').label
                                        })));
                                    })
                                }, function () {
                                    set.forEach(function (d) {
                                        if (d._selected_) {
                                            return;
                                        }
                                        d._iconObj.animate({width:lineOpt.dotRadius*2}, 100);
                                        d.toolTipHide();
                                    })
                                });
                        })(x);
                    }

                }
                if (lineOpt.area) {
                    //put all the dots to front to avoid covered by area
                    elements.forEach(function (el) {
                        el.dots && el.dots.forEach(function (dot) {
                            dot.toFront();
                        });
                    })
                }

            }
        }
    });

})(Venus.SvgChart);
