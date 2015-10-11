#!/usr/bin/env node
'use strict';

import fs from 'fs';
import _ from 'lodash';
import moment from 'moment';
import csv from 'fast-csv';
import pjson from '../package.json';

let inputFile = process.argv[2] || false;
let outputFile = process.argv[3] || false;

if (inputFile) {
  if (inputFile === '-v' || inputFile === '-version' || inputFile === '--version') {
    process.stdout.write(pjson.name + ' @ v' + pjson.version);
    process.exit();
  }

  if (!outputFile) {
    let tempArray = inputFile.split('.');
    tempArray.splice(-1, 0, 'happy');
    outputFile = tempArray.join('.');
  }

  let ws = fs.createWriteStream(outputFile);

  // Constructor function
  // TODO: Rewrite using ES6 classes, just for fun
  let HappyTime = function() {
    this.input = [];
  };

  HappyTime.prototype.start = function() {
    let _this = this;
    csv
      .fromPath(inputFile, {
        ignoreEmpty: true,
        delimiter: ';'
      })
      .on('data', function(data) {
        _this.input.push(data);
      })
      .on('error', function(err) {
        process.stdout.write(`
          Oh no! Something went wrong while reading the file.

          Please make sure you specify a CSV file that is semi-colon (;) separated.

          err`);
        process.exit(1);
      })
      .on('end', function() {
        process.stdout.write(`
          ${_this.input.length} rows successfully read.
          Processing...

          ============================================

          `);
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
    let segments = hours.split(',');
    let rounded = hours;

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
    let mappedDates = _.map(this.uniqueDates, function(date) {
      return moment(date, 'YYYY-MM-DD');
    });
    let minDate = _.min(mappedDates).format('YYYY-MM-DD');
    let maxDate = _.max(mappedDates).format('YYYY-MM-DD');

    let range = [];
    let startDate = minDate;

    while (startDate <= maxDate) {
      range.push(startDate);
      startDate = moment(startDate, 'YYYY-MM-DD').add(1, 'd').format('YYYY-MM-DD');
    }

    let columnHeaders = range;
    columnHeaders.unshift('Task');

    let output = [];

    this.uniqueTasks.forEach(function(task) {
      let newRow = {};
      columnHeaders.forEach(function(item) {
        newRow[item] = 0;
      });

      newRow.Task = task;
      output.push(newRow);
    });

    let sortedRows = _.sortBy(rows, function(row) {
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

    let newOutput = _.map(output, function(item) {
      return _.values(item);
    });

    newOutput.unshift(columnHeaders);
    return newOutput;
  };

  HappyTime.prototype.processCSV = function(input) {
    let _this = this;
    try {
      let headers = input.shift();  // eslint-disable-line
      let output1 = _.map(input, (row, count) => {
        let newRow = [];
        newRow.push(row[1]);  // Task
        newRow.push(moment(row[2], 'YYYY/MM/DD, h:mm A').format('YYYY-MM-DD'));   // Date
        newRow.push(row[4]);  // Hours
        return newRow;
      }).sort();

      let output2 = [];
      let task = '';
      let date = '';
      let hours = 0;
      let taskIndex = 0;
      let sameTask = false;
      let sameDay = false;
      let hasTemp = false;

      // Sum task times
      output1.forEach((row, count) => {
        sameTask = task === row[0] ? true : false;
        sameDay = date === row[1] ? true : false;

        if ((!sameTask || !sameDay) && hasTemp) {
          output2[ taskIndex - 1 ] = [ task, date, _this.stringHours(hours), _this.roundHours(_this.stringHours(hours)) ];
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
      let msg = `
      Bummer! Something went wrong while processing your CSV.

      Data expected in format:
      ======================================================================================================================
      PROJECT      | TASK                                          | START                 | END                    | HOURS
      Project 87   | Calculate likelihood of snail race winners    | 2015/09/03, 5:16 PM   | 2015/09/03, 5:39 PM    |  0,38
      ======================================================================================================================

      ${e}`;
      process.stdout.write(msg);
    }
  };

  HappyTime.prototype.outputCSV = function(output) {
    csv
      .write(output, { delimiter: ';' })
      .pipe(ws)
      .on('finish', function() {
        process.stdout.write(`Yay! Your timesheet is now happy.

          $ open "${outputFile}"`);
        process.exit();
      })
      .on('error', function(e) {
        process.stdout.write(`So close! Something went wrong while writing your CSV. ${e}`);
        process.exit(1);
      });
  };

  let ht = new HappyTime();
  ht.start();
} else {
  process.stdout.write(`Whoops. Please specify an input file.`);
  process.exit(1);
}
