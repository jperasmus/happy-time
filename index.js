#!/usr/bin/env node
'use strict';
var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');
var csv = require('fast-csv');
var pjson = require('./package.json');
var inputFile = process.argv[2] || false;
var outputFile = process.argv[3] || false;

if (inputFile) {
  if (inputFile === '-v' || inputFile === '-version' || inputFile === '--version') {
    process.stdout.write(pjson.name + ' @ v' + pjson.version);
    process.exit();
  }

  if (!outputFile) {
    var tempArray = inputFile.split('.');
    tempArray.splice(-1, 0, 'happy');
    outputFile = tempArray.join('.');
  }

  var ws = fs.createWriteStream(outputFile);

  var HappyTime = function() {
    this.input = [];
  };

  HappyTime.prototype.start = function() {
    var _this = this;
    csv
      .fromPath(inputFile, {
        ignoreEmpty: true,
        delimiter: ';'
      })
      .on('data', function(data){
        _this.input.push(data);
      })
      .on('error', function(err) {
        process.stdout.write('Oh no! Something went wrong while reading the file.\nPlease make sure you specify a CSV file that is semi-colon (;) separated.\n', err);
        process.exit(1);
      })
      .on('end', function(){
        process.stdout.write(_this.input.length + ' rows successfully read. Processing...\n\n');
        _this.outputCSV(_this.processCSV(_this.input));
      });
  };

  HappyTime.prototype.parseHours = function(string) {
    return parseInt((string.replace(',', '.') * 100), 10);
  };

  HappyTime.prototype.stringHours = function(hours) {
    return (hours / 100).toString().replace('.', ',');
  };

  HappyTime.prototype.roundHours = function(hours) {
    var segments = hours.split(',');
    var rounded = hours;

    if (segments[1]) {
      if (segments[1][0] >= 9 || (segments[1][0] >= 8 && (segments[1][1] >= 3 || false))) {
        rounded = (segments[0] * 1) + 1;
      } else if (segments[1][0] >= 7 || (segments[1][0] >= 6 && (segments[1][1] >= 3 || false))) {
        rounded = [ segments[0], 75 ].join(',');
      } else if (segments[1][0] >= 4 || (segments[1][0] >= 3 && (segments[1][1] >= 3 || false))) {
        rounded = [ segments[0], 5 ].join(',');
      } else if (segments[1][0] >= 2 || (segments[1][0] >= 1 && (segments[1][1] >= 3 || false))) {
        rounded = [ segments[0], 25 ].join(',');
      } else {
        rounded = segments[0];
      }
    }
    return rounded;
  };

  HappyTime.prototype.rowToGrid = function(rows) {
    this.uniqueDates = _.uniq(_.pluck(rows, 1), false);
    this.uniqueTasks = _.uniq(_.pluck(rows, 0), false);
    var mappedDates = _.map(this.uniqueDates, function(date) {
      return moment(date, 'YYYY-MM-DD');
    });
    var minDate = _.min(mappedDates).format('YYYY-MM-DD');
    var maxDate = _.max(mappedDates).format('YYYY-MM-DD');

    var range = [];
    var startDate = minDate;

    while (startDate <= maxDate) {
      range.push(startDate);
      startDate = moment(startDate, 'YYYY-MM-DD').add(1, 'd').format('YYYY-MM-DD');
    }

    var columnHeaders = range;
    columnHeaders.unshift('Task');

    var output = [];

    this.uniqueTasks.forEach(function(task) {
      var newRow = {};
      columnHeaders.forEach(function(item) {
        newRow[item] = 0;
      });

      newRow.Task = task;
      output.push(newRow);
    });

    var sortedRows = _.sortBy(rows, function(row) {
      return row[1];    // Sorted by date
    });

    sortedRows.forEach(function(outer) {
      output = _.map(output, function(inner, innerCount) {
        if (inner.Task === outer[0]) {
          inner[outer[1]] = outer[3];
        }
        return inner;
      });
    });

    var newOutput = _.map(output, function(item) {
      return _.values(item);
    });

    newOutput.unshift(columnHeaders);
    return newOutput;
  };

  HappyTime.prototype.processCSV = function(input) {
    var _this = this;
    try {
      var headers = input.shift();
      var output1 = _.map(input, function(row, count) {
        var newRow = [];
        newRow.push(row[1]);  // Task
        newRow.push(moment(row[2], 'YYYY/MM/DD, h:mm A').format('YYYY-MM-DD'));   // Date
        newRow.push(row[4]);  // Hours
        return newRow;
      }).sort();

      var output2 = [];
      var task = '';
      var date = '';
      var hours = 0;
      var taskIndex = 0;
      var sameTask = false;
      var sameDay = false;
      var hasTemp = false;

      // Sum task times
      output1.forEach(function(row, count) {
        sameTask = task === row[0] ? true : false;
        sameDay = date === row[1] ? true : false;

        if ((!sameTask || !sameDay) && hasTemp) {
          output2[taskIndex-1] = [ task, date, _this.stringHours(hours), _this.roundHours(_this.stringHours(hours)) ];
        }

        task = sameTask ? task : row[0];
        date = sameDay ? date : row[1];
        hours = sameDay && sameTask ? hours + _this.parseHours(row[2]) : _this.parseHours(row[2]);
        hasTemp = true;

        if (!sameDay || !sameTask) {
          output2[taskIndex] = [ task, date, _this.stringHours(hours), _this.roundHours(_this.stringHours(hours)) ];
          taskIndex = output2.length;
          hasTemp = false;
        } else if (output1.length === count + 1) {
          output2.push([ task, date, _this.stringHours(hours), _this.roundHours(_this.stringHours(hours)) ]);
          hasTemp = false;
        }
      });

      return _this.rowToGrid(output2);
    } catch (e) {
      var msg = 'Bummer! Something went wrong while processing your CSV.\nData expected in format:\n';
      msg += 'PROJECT;      TASK;                                         START;                END;                  HOURS;\n';
      msg += 'Project 87;   Calculate likelihood of snail race winners;   2015/09/03, 5:16 PM;  2015/09/03, 5:39 PM;  0,38;\n\n'
      process.stdout.write(msg, e);
    }
  };

  HappyTime.prototype.outputCSV = function(output) {
    csv
      .write(output, { delimiter: ';' })
      .pipe(ws)
      .on('finish', function(){
        process.stdout.write('Yay! Your timesheet is now happy.\n\n $ open "' + outputFile + '"');
        process.exit();
      })
      .on('error', function(e) {
        process.stdout.write('So close! Something went wrong while writing your CSV.', e);
        process.exit(1);
      });
  };

  var ht = new HappyTime();
  ht.start();
} else {
  process.stdout.write('Whoops. Please specify an input file.');
  process.exit(1);
}
