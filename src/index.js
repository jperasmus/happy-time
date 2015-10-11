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
  // Lookup version number
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
  class HappyTime {
    constructor() {
      this.input = [];
    }

    start() {
      // Read in CSV timesheet
      csv
        .fromPath(inputFile, {
          ignoreEmpty: true,
          delimiter: ';'
        })
        // As data come in from the read stream
        .on('data', (data) => {
          this.input.push(data);
        })
        // In case something goes wrong during the read
        .on('error', (err) => {
          process.stdout.write(`
            Oh no! Something went wrong while reading the file.

            Please make sure you specify a CSV file that is semi-colon (;) separated.

            Details: ${err}`);
          process.exit(1);
        })
        // When the whole stream has been read
        .on('end', () => {
          process.stdout.write(`
            ${this.input.length} rows successfully read.

            Processing...

            ============================================

            `);
          this.outputCSV(this.processCSV(this.input));
        });
    }

    parseHours(string) {
      return parseInt((string.replace(',', '.') * 100), 10);
    }

    stringHours(hours) {
      return (hours / 100).toString().replace('.', ',');
    }

    roundHours(hours) {
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
    }

    rowToGrid(rows) {
      this.uniqueProjects = _.uniq(_.pluck(rows, 0), false);
      this.uniqueDates = _.uniq(_.pluck(rows, 2), false);
      let mappedDates = _.map(this.uniqueDates, (date) => moment(date, 'YYYY-MM-DD'));
      let minDate = _.min(mappedDates).format('YYYY-MM-DD');
      let maxDate = _.max(mappedDates).format('YYYY-MM-DD');

      let range = [];
      let startDate = minDate;

      while (startDate <= maxDate) {
        range.push(startDate);
        startDate = moment(startDate, 'YYYY-MM-DD').add(1, 'd').format('YYYY-MM-DD');
      }

      let columnHeaders = range;
      columnHeaders.unshift('Project', 'Task');

      let output = [];

      this.uniqueProjects.forEach((project) => {
        let projectRows = _.filter(rows, (row) => row[0] === project);
        this.uniqueProjectTasks = _.uniq(_.pluck(projectRows, 1), false);

        this.uniqueProjectTasks.forEach((task) => {
          // Set all values to 0 so that empty cells can default to zero
          let newRow = {};
          columnHeaders.forEach((item) => {
            newRow[item] = 0;
          });

          // Overwrite the Project and Task names
          newRow.Project = project;
          newRow.Task = task;
          output.push(newRow);
        });

        // Sorted by date
        let sortedRows = _.sortBy(projectRows, (row) => row[2]);

        sortedRows.forEach((outer) => {
          output = _.map(output, (inner, innerCount) => {
            if (inner.Project === outer[0] && inner.Task === outer[1]) {
              inner[outer[2]] = outer[4];
            }
            return inner;
          });
        });
      });

      let newOutput = _.map(output, (item) => _.values(item));

      // Column Totals
      let columnTotals = ['', ''];
      _.forEach(range, (header, index) => {
        if (index > 1) {
          let columnValues = _.pluck(newOutput, index);
          let columnTotal = _.reduce(columnValues, (one, two) => parseFloat(one.toString().replace(',', '.')) + parseFloat(two.toString().replace(',', '.')), 0);
          columnTotals.push(columnTotal);
        }
      });
      newOutput.push(_.map(columnTotals, (item) => item.toString().replace('.', ',')));

      // Column Headers
      newOutput.unshift(columnHeaders);
      return newOutput;
    }

    processCSV(input) {
      try {
        // Remove headers
        this.inputHeaders = input.shift();

        // Get consistent data structure
        let output1 = _.map(input, (row, count) => {
          let newRow = [];
          newRow.push(row[0]);  // Project
          newRow.push(row[1]);  // Task
          newRow.push(moment(row[2], 'YYYY/MM/DD, h:mm A').format('YYYY-MM-DD'));   // Date
          newRow.push(row[4]);  // Hours
          return newRow;
        }).sort();

        let output2 = [];
        let project = '';
        let task = '';
        let date = '';
        let hours = 0;
        let taskIndex = 0;
        let sameProject = false;
        let sameTask = false;
        let sameDay = false;
        let hasTemp = false;

        // Summarize task times
        output1.forEach((row, count) => {
          sameProject = project === row[0] ? true : false;
          sameTask = task === row[1] ? true : false;
          sameDay = date === row[2] ? true : false;

          if ((!sameProject || !sameTask || !sameDay) && hasTemp) {
            output2[ taskIndex - 1 ] = [ project, task, date, this.stringHours(hours), this.roundHours(this.stringHours(hours)) ];
          }

          project = sameProject ? project : row[0];
          task = sameTask ? task : row[1];
          date = sameDay ? date : row[2];
          hours = sameDay && sameTask ? hours + this.parseHours(row[3]) : this.parseHours(row[3]);
          hasTemp = true;

          if (!sameProject || !sameTask || !sameDay) {
            output2[taskIndex] = [ project, task, date, this.stringHours(hours), this.roundHours(this.stringHours(hours)) ];
            taskIndex = output2.length;
            hasTemp = false;
          } else if (output1.length === count + 1) {
            output2.push([ project, task, date, this.stringHours(hours), this.roundHours(this.stringHours(hours)) ]);
            hasTemp = false;
          }
        });

        return this.rowToGrid(output2);
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
    }

    outputCSV(output) {
      csv
        .write(output, { delimiter: ';' })
        .pipe(ws)
        .on('finish', () => {
          process.stdout.write(`Yay! Your timesheet is now happy.

            $ open "${outputFile}"

          `);
          process.exit();
        })
        .on('error', (err) => {
          process.stdout.write(`So close! Something went wrong while writing your CSV. ${err}`);
          process.exit(1);
        });
    }
  }

  let ht = new HappyTime();
  ht.start();
} else {
  process.stdout.write(`Whoops. Please specify an input file.`);
  process.exit(1);
}
