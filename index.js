/**!
 * koa-roles - index.js
 *
 * Copyright(c) Alibaba Group Holding Limited.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <m@fengmk2.com> (http://fengmk2.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var is = require('is-type-of');

module.exports = KoaRoles;

/**
 * Role Middleware for Koa
 * @class KoaRoles
 * @example
 * ```js
 * var Roles = require('koa-roles');
 * var koa = require('koa');
 * var app = koa();
 *
 * var user = new Roles({
 *   failureHandler: function *(action) {
 *     // optional function to customise code that runs when
 *     // user fails authorisation
 *     this.status = 403;
 *     var t = this.accepts('json', 'html');
 *     if (t === 'json') {
 *       this.body = {
 *         message: 'Access Denied - You don\'t have permission to: ' + action
 *       };
 *     } else if (t === 'html') {
 *       this.render('access-denied', {action: action});
 *     } else {
 *       this.body = 'Access Denied - You don\'t have permission to: ' + action;
 *     }
 *   }
 * });
 *
 * app.use(user.middleware());
 *
 * // anonymous users can only access the home page
 * // returning false stops any more rules from being
 * // considered
 * user.use(function *(action) {
 *   return action === 'access home page';
 * });
 *
 * // moderator users can access private page, but
 * // they might not be the only ones so we don't return
 * // false if the user isn't a moderator
 * user.use('access private page', function (action) {
 *   if (this.user.role === 'moderator') {
 *     return true;
 *   }
 * });
 * app.get('/', user.can('access home page'), function *(next) {
 *   this.render('private');
 * });
 * app.get('/private', user.can('access private page'), function *(next) {
 *   this.render('private');
 * });
 * app.get('/admin', user.can('access admin page'), function *(next) {
 *   this.render('admin');
 * });
 *
 * app.listen(3000);
 * ```
 */
function KoaRoles(options) {
  options = options || {};
  this.functionList = [];
  this.failureHandler = options.failureHandler || defaultFailureHandler;
  this.userProperty = options.userProperty || 'user';
  this.actionMap = {};
}

/**
 * @method KoaRoles#use
 * @param {String} action - Name of role
 * @param {Function} fn
 */
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

  var old = this.actionMap[action];
  // create or override
  this.actionMap[action] = fn;

  // action fn have already been used, skip
  if (old) {
    return;
  }

  var roles = this;
  this.use1(function *(act) {
    // get fn from actionMap
    var fn = roles.actionMap[action];
    if (act === action) {
      if (is.generatorFunction(fn)) {
        return yield fn.call(this);
      } else {
        return fn.call(this);
      }
    }
  });
};

/**
 * @method KoaRoles#can
 * @param {String} action
 */
KoaRoles.prototype.can = function (action) {
  var roles = this;
  return function *(next) {
    if (yield roles.test(this, action)) {
      return yield next;
    }
    if (is.generatorFunction(roles.failureHandler)) {
      yield roles.failureHandler.call(this, action);
    } else {
      roles.failureHandler.call(this, action);
    }
  };
};

/**
 * @see KoaRoles#can
 * @method KoaRoles#is
 */
KoaRoles.prototype.is = KoaRoles.prototype.can;

/**
 * @method KoaRoles#test
 * @param {Context} ctx
 * @param {String} action
 */
KoaRoles.prototype.test = function *(ctx, action) {
  for (var i = 0; i < this.functionList.length; i++){
    var fn = this.functionList[i];
    var vote = null;
    if (is.generatorFunction(fn)) {
      vote = yield fn.call(ctx, action);
    } else {
      vote = fn.call(ctx, action);
    }
    if (typeof vote === 'boolean') {
      return vote;
    }
  }
  return false;
};

/**
 * @method KoaRoles#middleware
 */
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
    yield next;
  };
};

function tester(roles, ctx) {
  return function* (action) {
    return yield roles.test(ctx, action);
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
