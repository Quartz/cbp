var fm = require('./fm');
var throttle = require('./throttle');
var features = require('./detectFeatures')();
var d3 = require('d3');
var request = require('d3-request');
var _ = require('lodash');
var chosen = require('./libs/chosen.jquery.min.js')

var FIRST_YEAR = 1986;
var LAST_YEAR = 2013;
var MOBILE_THRESHOLD = 600;

// D3 formatters
var fmtComma = d3.format(',');
var fmtYearAbbrev = d3.time.format('%y');
var fmtYearFull = d3.time.format('%Y');

var $picker = null;

var employeeData = {};
var currentNaics = '311111';
var isMobile = false;

function init () {
    $picker = $('#picker');

	request.json('./data/means.json', function(err, data) {
		employeeData = data;

		update();

        populatePicker();

        $picker
            .chosen({ width: '300px' })
            .change(onPickerChange)
            .val(currentNaics)
            .trigger("chosen:updated");;

        $('#examples a').on('click', onExampleClick);
	});
}

function populatePicker() {
    _.each(employeeData, function(data, naics) {
        var opt = $('<option>', { value: naics }).text(data['description']);
        $picker.append(opt);
    })
}

function onPickerChange(e) {
    e.preventDefault();

    currentNaics = $(this).val();

    update();
}

function onExampleClick(e) {
    e.preventDefault();

    currentNaics = $(this).data('naics');
    $picker.val(currentNaics).trigger("chosen:updated");;

    update();
}

function update () {
	var width = $('#interactive-content').width();

	if (width <= MOBILE_THRESHOLD) {
		isMobile = true;
	} else {
		isMobile = false;
	}

    $('#chart-title .naics').text(currentNaics);
    $('#chart-title .description').text(employeeData[currentNaics]['description']);

	// Render the chart!
	renderColumnChart({
		container: '#chart',
		width: width,
		data: employeeData[currentNaics]
	});

	// adjust iframe for dynamic content
	fm.resize()
}

function resize() {
	update()
}

/*
 * Render a column chart.
 */
var renderColumnChart = function(config) {
	/*
	 * Setup chart container.
	 */
    var aspectRatio = 7/3;

	var margins = {
		top: 10,
		right: 5,
		bottom: 25,
		left: 80
	};

    /*
     * Format data
     */
    var formattedData = [];

    for (i = FIRST_YEAR; i <= LAST_YEAR; i++) {
        formattedData.push(config['data'][i.toString()]);
    }

	// Calculate actual chart dimensions
	var chartWidth = config['width'] - margins['left'] - margins['right'];
	var chartHeight = Math.ceil(config['width'] / aspectRatio) - margins['top'] - margins['bottom'];

	// Clear existing graphic (for redraw)
	var containerElement = d3.select(config['container']);
	containerElement.html('');

	/*
	 * Create the root SVG element.
	 */
	var chartWrapper = containerElement.append('div')
		.attr('class', 'graphic-wrapper');

	var chartElement = chartWrapper.append('svg')
		.attr('width', chartWidth + margins['left'] + margins['right'])
		.attr('height', chartHeight + margins['top'] + margins['bottom'])
		.append('g')
		.attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

	/*
	 * Create D3 scale objects.
	 */
	var domain = [];

	for (i = FIRST_YEAR; i <= LAST_YEAR; i++) {
		domain.push(i);
	}

	var xScale = d3.scale.ordinal()
		.rangeRoundBands([0, chartWidth], .1)
		.domain(domain);

    var maxValue = _.max(formattedData);

	var yScale = d3.scale.linear()
		.range([chartHeight, 0])
		.domain([0, maxValue]);

	/*
	 * Create D3 axes.
	 */
	var xAxis = d3.svg.axis()
	.scale(xScale)
	.orient('bottom')
	.tickFormat(function(d, i) {
		if (d % 5 != 0) {
			return '';
		}

		if (isMobile) {
			return "'" + d.toString().substring(2, 4);
		}

		return d;
	});

	var yAxis = d3.svg.axis()
		.scale(yScale)
		.orient('left')
		.tickFormat(function(d, i) {
			var label = fmtComma(d);

			return label;
		});

	/*
	 * Render axes to chart.
	 */
	var xAxisElement = chartElement.append('g')
		.attr('class', 'x axis')
		.attr('transform', makeTranslate(0, chartHeight))
		.call(xAxis);

	var yAxisElement = chartElement.append('g')
		.attr('class', 'y axis')
		.call(yAxis)

	/*
	 * Render grid to chart.
	 */
	var yAxisGrid = function() {
		return yAxis;
	};

	yAxisElement.append('g')
		.attr('class', 'y grid')
		.call(yAxisGrid()
			.tickSize(-chartWidth, 0)
			.tickFormat('')
		);

	/*
	 * Render bars to chart.
	 */
	chartElement.append('g')
		.attr('class', 'bars')
		.selectAll('rect')
		.data(formattedData)
		.enter()
		.append('rect')
			.attr('x', function(d, i) {
				return xScale(FIRST_YEAR + i);
			})
			.attr('y', function(d) {
				return yScale(d);
			})
			.attr('width', xScale.rangeBand())
			.attr('height', function(d) {
				return yScale(0) - yScale(d);
			})
			.attr('class', function(d) {
				return 'bar';
			});
}

/*
 * Convert arbitrary strings to valid css classes.
 * via: https://gist.github.com/mathewbyrne/1280286
 */
var classify = function(str) {
	return str.toLowerCase()
		.replace(/\s+/g, '-')					 // Replace spaces with -
		.replace(/[^\w\-]+/g, '')			 // Remove all non-word chars
		.replace(/\-\-+/g, '-')				 // Replace multiple - with single -
		.replace(/^-+/, '')						 // Trim - from start of text
		.replace(/-+$/, '');						// Trim - from end of text
}

/*
 * Convert key/value pairs to a style string.
 */
var formatStyle = function(props) {
	var s = '';

	for (var key in props) {
		s += key + ': ' + props[key].toString() + '; ';
	}

	return s;
}

/*
 * Create a SVG tansform for a given translation.
 */
var makeTranslate = function(x, y) {
	var transform = d3.transform();

	transform.translate[0] = x;
	transform.translate[1] = y;

	return transform.toString();
}

var throttleRender = throttle(resize, 250);

$(document).ready(function () {
	// adjust iframe for loaded content
	fm.resize()
	$(window).resize(throttleRender);
	init();
});
