var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var concat = require('gulp-concat');
var del = require('del');

var src = 'src/**/*.js';
var dist = 'dist';

gulp.task('scripts', function() {
  return gulp.src(src)
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(concat('entry.js'))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(dist));
});

gulp.task('watch', function() {
  gulp.watch(src, ['scripts']);
});

gulp.task('clean', function(cb) {
  del([dist], cb);
});

gulp.task('default', ['build', 'watch']);

gulp.task('build', ['clean'], function() {
  gulp.start(['scripts']);
});
