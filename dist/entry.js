#!/usr/bin/env node

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _fastCsv = require('fast-csv');

var _fastCsv2 = _interopRequireDefault(_fastCsv);

var _packageJson = require('../package.json');

var _packageJson2 = _interopRequireDefault(_packageJson);

var inputFile = process.argv[2] || false;
var outputFile = process.argv[3] || false;

if (inputFile) {
  (function () {
    if (inputFile === '-v' || inputFile === '-version' || inputFile === '--version') {
      process.stdout.write(_packageJson2['default'].name + ' @ v' + _packageJson2['default'].version);
      process.exit();
    }

    if (!outputFile) {
      var tempArray = inputFile.split('.');
      tempArray.splice(-1, 0, 'happy');
      outputFile = tempArray.join('.');
    }

    var ws = _fs2['default'].createWriteStream(outputFile);

    // Constructor function
    // TODO: Rewrite using ES6 classes, just for fun
    var HappyTime = function HappyTime() {
      this.input = [];
    };

    HappyTime.prototype.start = function () {
      var _this = this;
      _fastCsv2['default'].fromPath(inputFile, {
        ignoreEmpty: true,
        delimiter: ';'
      }).on('data', function (data) {
        _this.input.push(data);
      }).on('error', function (err) {
        process.stdout.write('\n          Oh no! Something went wrong while reading the file.\n\n          Please make sure you specify a CSV file that is semi-colon (;) separated.\n\n          err');
        process.exit(1);
      }).on('end', function () {
        process.stdout.write('\n          ' + _this.input.length + ' rows successfully read.\n          Processing...\n\n          ============================================\n\n          ');
        _this.outputCSV(_this.processCSV(_this.input));
      });
    };

    HappyTime.prototype.parseHours = function (string) {
      return parseInt(string.replace(',', '.') * 100, 10);
    };

    HappyTime.prototype.stringHours = function (hours) {
      return (hours / 100).toString().replace('.', ',');
    };

    HappyTime.prototype.roundHours = function (hours) {
      var segments = hours.split(',');
      var rounded = hours;

      if (segments[1]) {
        if (segments[1][0] >= 9 || segments[1][0] >= 8 && (segments[1][1] >= 3 || false)) {
          rounded = segments[0] * 1 + 1;
        } else if (segments[1][0] >= 7 || segments[1][0] >= 6 && (segments[1][1] >= 3 || false)) {
          rounded = [segments[0], 75].join(',');
        } else if (segments[1][0] >= 4 || segments[1][0] >= 3 && (segments[1][1] >= 3 || false)) {
          rounded = [segments[0], 5].join(',');
        } else if (segments[1][0] >= 2 || segments[1][0] >= 1 && (segments[1][1] >= 3 || false)) {
          rounded = [segments[0], 25].join(',');
        } else {
          rounded = segments[0];
        }
      }
      return rounded;
    };

    HappyTime.prototype.rowToGrid = function (rows) {
      this.uniqueDates = _lodash2['default'].uniq(_lodash2['default'].pluck(rows, 1), false);
      this.uniqueTasks = _lodash2['default'].uniq(_lodash2['default'].pluck(rows, 0), false);
      var mappedDates = _lodash2['default'].map(this.uniqueDates, function (date) {
        return (0, _moment2['default'])(date, 'YYYY-MM-DD');
      });
      var minDate = _lodash2['default'].min(mappedDates).format('YYYY-MM-DD');
      var maxDate = _lodash2['default'].max(mappedDates).format('YYYY-MM-DD');

      var range = [];
      var startDate = minDate;

      while (startDate <= maxDate) {
        range.push(startDate);
        startDate = (0, _moment2['default'])(startDate, 'YYYY-MM-DD').add(1, 'd').format('YYYY-MM-DD');
      }

      var columnHeaders = range;
      columnHeaders.unshift('Task');

      var output = [];

      this.uniqueTasks.forEach(function (task) {
        var newRow = {};
        columnHeaders.forEach(function (item) {
          newRow[item] = 0;
        });

        newRow.Task = task;
        output.push(newRow);
      });

      var sortedRows = _lodash2['default'].sortBy(rows, function (row) {
        return row[1]; // Sorted by date
      });

      sortedRows.forEach(function (outer) {
        output = _lodash2['default'].map(output, function (inner, innerCount) {
          if (inner.Task === outer[0]) {
            inner[outer[1]] = outer[3];
          }
          return inner;
        });
      });

      var newOutput = _lodash2['default'].map(output, function (item) {
        return _lodash2['default'].values(item);
      });

      newOutput.unshift(columnHeaders);
      return newOutput;
    };

    HappyTime.prototype.processCSV = function (input) {
      var _this = this;
      try {
        var _ret2 = (function () {
          var headers = input.shift(); // eslint-disable-line
          var output1 = _lodash2['default'].map(input, function (row, count) {
            var newRow = [];
            newRow.push(row[1]); // Task
            newRow.push((0, _moment2['default'])(row[2], 'YYYY/MM/DD, h:mm A').format('YYYY-MM-DD')); // Date
            newRow.push(row[4]); // Hours
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
          output1.forEach(function (row, count) {
            sameTask = task === row[0] ? true : false;
            sameDay = date === row[1] ? true : false;

            if ((!sameTask || !sameDay) && hasTemp) {
              output2[taskIndex - 1] = [task, date, _this.stringHours(hours), _this.roundHours(_this.stringHours(hours))];
            }

            task = sameTask ? task : row[0];
            date = sameDay ? date : row[1];
            hours = sameDay && sameTask ? hours + _this.parseHours(row[2]) : _this.parseHours(row[2]);
            hasTemp = true;

            if (!sameDay || !sameTask) {
              output2[taskIndex] = [task, date, _this.stringHours(hours), _this.roundHours(_this.stringHours(hours))];
              taskIndex = output2.length;
              hasTemp = false;
            } else if (output1.length === count + 1) {
              output2.push([task, date, _this.stringHours(hours), _this.roundHours(_this.stringHours(hours))]);
              hasTemp = false;
            }
          });

          return {
            v: _this.rowToGrid(output2)
          };
        })();

        if (typeof _ret2 === 'object') return _ret2.v;
      } catch (e) {
        var msg = '\n      Bummer! Something went wrong while processing your CSV.\n\n      Data expected in format:\n      ======================================================================================================================\n      PROJECT      | TASK                                          | START                 | END                    | HOURS\n      Project 87   | Calculate likelihood of snail race winners    | 2015/09/03, 5:16 PM   | 2015/09/03, 5:39 PM    |  0,38\n      ======================================================================================================================\n\n      ' + e;
        process.stdout.write(msg);
      }
    };

    HappyTime.prototype.outputCSV = function (output) {
      _fastCsv2['default'].write(output, { delimiter: ';' }).pipe(ws).on('finish', function () {
        process.stdout.write('Yay! Your timesheet is now happy.\n\n          $ open "' + outputFile + '"');
        process.exit();
      }).on('error', function (e) {
        process.stdout.write('So close! Something went wrong while writing your CSV. ' + e);
        process.exit(1);
      });
    };

    var ht = new HappyTime();
    ht.start();
  })();
} else {
  process.stdout.write('Whoops. Please specify an input file.');
  process.exit(1);
}
//# sourceMappingURL=entry.js.map
