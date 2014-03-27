/**!
 * koa-roles - index.js
 *
 * Copyright(c) Alibaba Group Holding Limited.
 * MIT Licensed
 *
 * Authors:
 *   苏千 <suqian.yf@alibaba-inc.com> (http://fengmk2.github.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var is = require('is-type-of');
var pathToRegexp = require('path-to-regexp');

module.exports = KoaRoles;

function KoaRoles(options) {
  options = options || {};
  this.functionList = [];
  this.failureHandler = options.failureHandler || defaultFailureHandler;
  this.userProperty = options.userProperty || 'user';
}

KoaRoles.prototype.use = function () {
  if (arguments.length === 1) {
    // role.use(fn);
    this.use1(arguments[0]);
  } else if (arguments.length === 2) {
    // role.use(action, fn);
    this.use2(arguments[0], arguments[1]);
  } else {
    throw new Error('use can have 1 or 2 arguments, not ' + arguments.length);
  }
};

function assertFunction(fn) {
  if (!is.function(fn)) {
    throw new TypeError('Expected fn to be of type function or generator function');
  }
}

KoaRoles.prototype.use1 = function (fn) {
  assertFunction(fn);
  this.functionList.push(fn);
};

KoaRoles.prototype.use2 = function (action, fn) {
  if (typeof action !== 'string') {
    throw new TypeError('Expected action to be of type string');
  }
  if (action[0] === '/') {
    throw new TypeError('action can\'t start with `/`');
  }
  assertFunction(fn);
  this.use1(function *(act) {
    if (act === action) {
      if (is.generatorFunction(fn)) {
        return yield *fn.call(this);
      } else {
        return fn.call(this);
      }
    }
  });
};

KoaRoles.prototype.can = function (action) {
  var roles = this;
  return function *(next) {
    if (yield *roles.test(this, action)) {
      return yield *next;
    }
    if (is.generatorFunction(roles.failureHandler)) {
      yield *roles.failureHandler.call(this, action);
    } else {
      roles.failureHandler.call(this, action);
    }
  };
};

KoaRoles.prototype.is = KoaRoles.prototype.can;

KoaRoles.prototype.test = function *(ctx, action) {
  for (var i = 0; i < this.functionList.length; i++){
    var fn = this.functionList[i];
    var vote = null;
    if (is.generatorFunction(fn)) {
      vote = yield *fn.call(ctx, action);
    } else {
      vote = fn.call(ctx, action);
    }
    if (typeof vote === 'boolean') {
      return vote;
    }
  }
  return false;
};

KoaRoles.prototype.middleware = function (options) {
  options = options || {};
  var userProperty = options.userProperty || this.userProperty;
  var roles = this;
  return function *(next) {
    var ctx = this;
    var roleCheck = tester(roles, ctx);
    if (ctx[userProperty]) {
      ctx[userProperty].is = ctx[userProperty].can = roleCheck;
      if (this.locals && !this.locals[userProperty]) {
        this.locals[userProperty] = this[userProperty];
      }
    }
    this.userIs = this.userCan = roleCheck;
    yield *next;
  };
};

function tester(roles, ctx) {
  return function *(action) {
    return yield *roles.test(ctx, action);
  };
}

function defaultFailureHandler(action) {
  this.status = 403;
  var t = this.accepts('json', 'html');
  if (t === 'json') {
    this.body = {
      message: 'Access Denied - You don\'t have permission to: ' + action
    };
  } else {
    this.body = 'Access Denied - You don\'t have permission to: ' + action;
  }
}
