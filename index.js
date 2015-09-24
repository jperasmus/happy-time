#!/usr/bin/env node
'use strict';
var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');
var csv = require('fast-csv');
var inputFile = process.argv[2] || false;
var outputFile = process.argv[3] || 'happy-' + inputFile;
var ws = fs.createWriteStream(outputFile);

if (inputFile) {
  var input = [];

  csv
    .fromPath(inputFile, {
      ignoreEmpty: true,
      delimiter: ';'
    })
    .on('data', function(data){
      input.push(data);
    })
    .on('error', function(err) {
      console.warn(err);
    })
    .on('end', function(){
      outputCSV(processCSV(input));
    });

  var parseHours = function(string) {
    return parseInt((string.replace(',', '.') * 100), 10);
  };

  var stringHours = function(hours) {
    return (hours / 100).toString().replace('.', ',');
  };

  var roundHours = function(hours) {
    var segments = hours.split(',');
    var rounded = hours;

    if (segments[1]) {
      if (segments[1][0] > 7) {
        rounded = (segments[0] * 1) + 1;
      } else if (segments[1][0] > 5) {
        rounded = [ segments[0], 75 ].join(',');
      } else if (segments[1][0] > 2) {
        rounded = [ segments[0], 5 ].join(',');
      } else {
        rounded = segments[0];
      }
    }
    return rounded;
  };

  var processCSV = function(input) {
    var headers = input.shift();
    var output1 = _.map(input, function(row, count) {
      var newRow = [];

      // Task
      newRow.push(row[1]);

      // Date
      newRow.push(moment(row[2], 'YYYY/MM/DD, h:mm A').format('YYYY-MM-DD'));

      // Hours
      newRow.push(row[4]);

      return newRow;
    });

    output1.sort();

    var output2 = [];
    var task = '';
    var date = '';
    var hours = 0;
    var taskIndex = 0;

    output1.forEach(function(row, count) {
      var sameTask = task === row[0] ? true : false;
      var sameDay = date === row[1] ? true : false;

      task = sameTask ? task : row[0];
      date = sameDay ? date : row[1];
      hours = sameDay || sameTask ? hours + parseHours(row[2]) : parseHours(row[2]);

      if (!sameDay || !sameTask) {
        output2[taskIndex] = [ task, date, stringHours(hours), roundHours(stringHours(hours)) ];
        taskIndex = output2.length;
      } else if (output1.length === count + 1) {
        output2.push([ task, date, stringHours(hours), roundHours(stringHours(hours)) ]);
      }
    });

    output2.unshift(['Task', 'Date', 'Hours', 'Rounded Hours']);
    return output2;
  };

  var outputCSV = function(output) {
    csv
      .write(output, { delimiter: ';' })
      .pipe(ws);

    console.log('Yay! Timesheet is in happy format.');
  };
} else {
  console.warn('Whoops. Please specify input file.');
}
