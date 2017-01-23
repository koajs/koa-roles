/**!
 * koa-roles - test/koa-roles.test.js
 *
 * Copyright(c) 2014 fengmk2 and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 */

'use strict';

/**
 * Module dependencies.
 */

require('should');
var request = require('supertest');
var koa = require('koa');
var sleep = require('co-sleep');
var router = require('koa-router');
var pedding = require('pedding');
var Promise = require('bluebird');
var Roles = require('../');

describe('koa-roles.test.js', function () {
  var app = koa();
  var roles = new Roles();

  roles.use('every one', function *() {
    return true;
  });

  roles.use('user or admin', function *() {
    yield sleep(1);
    return this.query.role === 'user' || this.query.role === 'admin';
  });

  roles.use('employee', function() {
    const role = this.query.role;
    return new Promise(function(resolve) {
      setTimeout(function() {
        resolve(role === 'employee');
      }, 1000);
    });
  });

  roles.use('update', function () {
    return this.query.role === 'user';
  });

  roles.use('user', function () {
    return this.query.role === 'user';
  });

  roles.use('friend', function () {
    return this.query.role === 'shaoshuai0102';
  });

  // override previous friend
  roles.use('friend', function () {
    return this.query.role === 'bar';
  });

  // default
  roles.use(function (action) {
    if (this.query.role === action) {
      return true;
    }
  });

  // other default role check using generator function
  roles.use(function *(action) {
    yield sleep(2);
    if (this.query.role2 === action) {
      return true;
    }
  });

  // using async function
  roles.use(function(action) {
    const role = this.query.role3;
    return new Promise(function(resolve) {
      setTimeout(function() {
        resolve(role === action);
      }, 1000);
    });
  });

  app.use(function *(next) {
    if (this.query.role) {
      this.user = {};
      this.locals = {};
    }
    yield next;
  });

  app.use(roles.middleware());

  app.use(router(app));

  app.get('/', roles.can('every one'), function *() {
    this.body = 'page for every one can visit';
  });

  app.get('/admin', roles.can('admin'), function *() {
    this.body = 'page only for admin can visit';
  });

  app.get('/admin/employee', roles.can('employee'), function *() {
    this.body = 'page for employee can visit';
  });

  app.get('/user', roles.is('user'), function *() {
    this.body = 'page only for user';
  });

  app.post('/profile/:id', roles.can('update'), function *() {
    this.body = 'page for user update';
  });

  app.get('/profile/:id', roles.can('user or admin'), function *() {
    this.body = 'page can visit by user or admin, current is ' + this.query.role;
  });

  app.get('/friend', roles.can('friend'), function *() {
    this.body = 'The best friend of foo is ' + this.query.role;
  });

  app.get('/any', function *() {
    var isadmin = yield this.userCan('admin');
    if (!isadmin) {
      return this.throw(403);
    }
    this.body = 'hello admin';
  });

  before(function (done) {
    app = app.listen(0, done);
  });

  it('should throw Error when arguments bigger than 2', function () {
    (function () {
      roles.use(1, 2, 3);
    }).should.throw('use can have 1 or 2 arguments, not 3');
  });

  it('should throw Error when action start /', function () {
    (function () {
      roles.use('/foo', function () {});
    }).should.throw('action can\'t start with `/`');
  });

  it('should throw Error when action is not string', function () {
    (function () {
      roles.use(1, function () {});
    }).should.throw('Expected action to be of type string');
  });

  it('should throw Error when fn is not function', function () {
    (function () {
      roles.use('foo');
    }).should.throw('Expected fn to be of type function or generator function');
  });

  it('should get / 200 for every one', function (done) {
    request(app)
    .get('/')
    .expect('page for every one can visit')
    .expect(200, done);
  });

  it('should get / 200 for admin', function (done) {
    done = pedding(2, done);
    request(app)
    .get('/?role=admin')
    .expect('page for every one can visit')
    .expect(200, done);

    request(app)
    .get('/?role2=admin')
    .expect('page for every one can visit')
    .expect(200, done);

    request(app)
    .get('/?role3=admin')
    .expect('page for every one can visit')
    .expect(200, done);
  });

  it('should get / 200 for employee', function (done) {
    request(app)
    .get('/admin/employee?role=employee')
    .expect('page for employee can visit')
    .expect(200, done);
  });

  it('should get /admin 200 for admin', function (done) {
    done = pedding(4, done);
    request(app)
    .get('/admin?role=admin')
    .expect('page only for admin can visit')
    .expect(200, done);

    request(app)
    .get('/admin?role2=admin')
    .expect('page only for admin can visit')
    .expect(200, done);

    request(app)
    .get('/admin?role2=admin2')
    .set('accept', 'html')
    .expect('Access Denied - You don\'t have permission to: admin')
    .expect(403, done);

    request(app)
    .get('/admin?role2=admin2')
    .set('accept', 'application/json')
    .expect({'message': 'Access Denied - You don\'t have permission to: admin'})
    .expect(403, done);
  });

  it('should get /profile/:id 200 for admin or user', function (done) {
    done = pedding(3, done);
    request(app)
    .get('/profile/101?role=admin')
    .expect('page can visit by user or admin, current is admin')
    .expect(200, done);

    request(app)
    .get('/profile/1?role=user')
    .expect('page can visit by user or admin, current is user')
    .expect(200, done);

    request(app)
    .get('/profile/2?role2=admin2')
    .set('accept', 'application/json')
    .expect({'message': 'Access Denied - You don\'t have permission to: user or admin'})
    .expect(403, done);
  });

  it('should get /user 200 for user', function (done) {
    done = pedding(3, done);
    request(app)
    .get('/user?role=user')
    .expect('page only for user')
    .expect(200, done);

    request(app)
    .get('/user?role=admin')
    .expect(403, done);

    request(app)
    .get('/user')
    .expect(403, done);
  });

  it('should get /any 200 for admin', function (done) {
    done = pedding(2, done);
    request(app)
    .get('/any?role=admin')
    .expect('hello admin')
    .expect(200, done);

    request(app)
    .get('/any')
    .expect('Forbidden')
    .expect(403, done);
  });

  it('should post /profile 200 for user update', function (done) {
    done = pedding(3, done);
    request(app)
    .post('/profile/1?role=user')
    .expect('page for user update')
    .expect(200, done);

    request(app)
    .post('/profile/1?role=other')
    .expect({'message': 'Access Denied - You don\'t have permission to: update'})
    .expect(403, done);

    request(app)
    .post('/profile/1/123?role=other')
    .expect(404, done);
  });

  it('should get /friend 200 for bar', function(done) {
    request(app)
    .get('/friend?role=bar')
    .expect('The best friend of foo is bar')
    .expect(200, done);
  });

  it('should get /friend 403 for shaoshuai0102 because of role override', function(done) {
    request(app)
    .get('/friend?role=shaoshuai0102')
    .expect({'message': 'Access Denied - You don\'t have permission to: friend'})
    .expect(403, done);
  });
});
