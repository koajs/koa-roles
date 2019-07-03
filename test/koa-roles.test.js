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
const request = require('supertest');
const koa = require('koa');
const sleep = require('co-sleep');
const Router = require('koa-router');
const pedding = require('pedding');
const Roles = require('../');

describe('koa-roles.test.js', function() {
  let app = new koa();
  const roles = new Roles();

  roles.use('every one', async function() {
    return true;
  });

  roles.use('user or admin', async ctx => {
    await sleep(1);
    return ctx.query.role === 'user' || ctx.query.role === 'admin';
  });

  roles.use('employee', ctx => {
    const role = ctx.query.role;
    return new Promise(function(resolve) {
      setTimeout(function() {
        resolve(role === 'employee');
      }, 1000);
    });
  });

  roles.use('update', ctx => {
    return ctx.query.role === 'user';
  });

  roles.use('user', ctx => {
    return ctx.query.role === 'user';
  });

  roles.use('friend', ctx => {
    return ctx.query.role === 'shaoshuai0102';
  });

  // override previous friend
  roles.use('friend', ctx => {
    return ctx.query.role === 'bar';
  });

  // default
  roles.use((ctx, action) => {
    if (ctx.query.role === action) {
      return true;
    }
  });

  // other default role check using generator function
  roles.use(async (ctx, action) => {
    await sleep(2);
    if (ctx.query.role2 === action) {
      return true;
    }
  });

  // using async function
  roles.use((ctx, action) => {
    const role = ctx.query.role3;
    return new Promise(function(resolve) {
      setTimeout(function() {
        resolve(role === action);
      }, 1000);
    });
  });

  app.use((ctx, next) => {
    if (ctx.query.role) {
      ctx.user = {};
      ctx.locals = {};
    }
    return next();
  });

  app.use(roles.middleware());

  const router = new Router();
  app.use(router.routes());

  router.get('/', roles.can('every one'), async ctx => {
    ctx.body = 'page for every one can visit';
  });

  router.get('/admin', roles.can('admin'), async ctx => {
    ctx.body = 'page only for admin can visit';
  });

  router.get('/admin/employee', roles.can('employee'), async ctx => {
    ctx.body = 'page for employee can visit';
  });

  router.get('/user', roles.is('user'), async ctx => {
    ctx.body = 'page only for user';
  });

  router.post('/profile/:id', roles.can('update'), async ctx => {
    ctx.body = 'page for user update';
  });

  router.get('/profile/:id', roles.can('user or admin'), async ctx => {
    ctx.body = 'page can visit by user or admin, current is ' + ctx.query.role;
  });

  router.get('/friend', roles.can('friend'), async ctx => {
    ctx.body = 'The best friend of foo is ' + ctx.query.role;
  });

  router.get('/user/or/friend', roles.can('user', 'friend'), async ctx => {
    ctx.body = 'user or friend is ok';
  });

  router.get('/any', async ctx => {
    const isadmin = await ctx.userCan('admin');
    if (!isadmin) {
      return ctx.throw(403);
    }
    ctx.body = 'hello admin';
  });

  before(function(done) {
    app = app.listen(0, done);
  });

  it('should throw Error when arguments bigger than 2', function() {
    (function() {
      roles.use(1, 2, 3);
    }).should.throw('use can have 1 or 2 arguments, not 3');
  });

  it('should throw Error when action start /', function() {
    (function() {
      roles.use('/foo', function() {});
    }).should.throw('action can\'t start with `/`');
  });

  it('should throw Error when action is not string', function() {
    (function() {
      roles.use(1, function() {});
    }).should.throw('Expected action to be of type string');
  });

  it('should throw Error when fn is not function', function() {
    (function() {
      roles.use('foo');
    }).should.throw('Expected fn to be of type function or generator function');
  });

  it('should get / 200 for every one', function(done) {
    request(app)
      .get('/')
      .expect('page for every one can visit')
      .expect(200, done);
  });

  it('should get / 200 for admin', function(done) {
    done = pedding(3, done);
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

  it('should get / 200 for employee', function(done) {
    request(app)
      .get('/admin/employee?role=employee')
      .expect('page for employee can visit')
      .expect(200, done);
  });

  it('should get /admin 200 for admin', function(done) {
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
      .expect({ message: 'Access Denied - You don\'t have permission to: admin' })
      .expect(403, done);
  });

  it('should get /profile/:id 200 for admin or user', function(done) {
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
      .expect({ message: 'Access Denied - You don\'t have permission to: user or admin' })
      .expect(403, done);
  });

  it('should get /user 200 for user', function(done) {
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

  it('should get /any 200 for admin', function(done) {
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

  it('should post /profile 200 for user update', function(done) {
    done = pedding(3, done);
    request(app)
      .post('/profile/1?role=user')
      .expect('page for user update')
      .expect(200, done);

    request(app)
      .post('/profile/1?role=other')
      .expect({ message: 'Access Denied - You don\'t have permission to: update' })
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
      .expect({ message: 'Access Denied - You don\'t have permission to: friend' })
      .expect(403, done);
  });

  it('should get /user/or/friend 200 for user or bar', function(done) {
    done = pedding(3, done);
    request(app)
      .get('/user/or/friend?role=user')
      .expect('user or friend is ok')
      .expect(200, done);

    request(app)
      .get('/user/or/friend?role=bar')
      .expect('user or friend is ok')
      .expect(200, done);

    request(app)
      .get('/user/or/friend')
      .expect({ message: 'Access Denied - You don\'t have permission to: user or friend' })
      .expect(403, done);
  });
});
