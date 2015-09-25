# happy-time

Simple formatter to format exported Caato CSV timesheets into a nicer summarized daily time to keep project managers happy.

## Install

```
$ npm install -g happy-time
```

## Usage

Once you've globally installed the node package you can run the CLI as:

```
$ happy-time <input filename> [optional output filename]
```

### Example
```
$ happy-time caato-timesheet.csv happy-timesheet.csv
```

#### OR
```
$ happy-time caato-timesheet.csv
// Will produce "happy-caato-timesheet.csv"
```

### Note
This tool is created for personal use. It assumes a very specific semi-colon separated CSV file as input. Feel free to use it in the odd chance that you want to do the exact same thing.
