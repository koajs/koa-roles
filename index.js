'use strict';

const is = require('is-type-of');

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
KoaRoles.prototype.use = function() {
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

KoaRoles.prototype.use1 = function(fn) {
  assertFunction(fn);
  this.functionList.push(fn);
};

KoaRoles.prototype.use2 = function(action, fn) {
  if (typeof action !== 'string') {
    throw new TypeError('Expected action to be of type string');
  }
  if (action[0] === '/') {
    throw new TypeError('action can\'t start with `/`');
  }
  assertFunction(fn);

  const old = this.actionMap[action];
  // create or override
  this.actionMap[action] = fn;

  // action fn have already been used, skip
  if (old) {
    return;
  }

  const roles = this;
  this.use1((ctx, act) => {
    // get fn from actionMap
    const fn = roles.actionMap[action];
    if (act === action) {
      return fn(ctx, act);
    }
  });
};

/**
 * @method KoaRoles#can
 * @param {String} action
 */
KoaRoles.prototype.can = function(action) {
  const roles = this;
  return async (ctx, next) => {
    if (await roles.test(ctx, action)) {
      return next();
    }
    const r = roles.failureHandler(ctx, action);
    if (is.promise(r)) await r;
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
KoaRoles.prototype.test = async function(ctx, action) {
  for (let i = 0; i < this.functionList.length; i++) {
    const fn = this.functionList[i];
    let vote = fn(ctx, action);
    if (is.promise(vote)) vote = await vote;

    if (typeof vote === 'boolean') return vote;
  }
  return false;
};

/**
 * @method KoaRoles#middleware
 */
KoaRoles.prototype.middleware = function(options) {
  options = options || {};
  const userProperty = options.userProperty || this.userProperty;
  const roles = this;
  return (ctx, next) => {
    const roleCheck = tester(roles, ctx);
    if (ctx[userProperty]) {
      ctx[userProperty].is = ctx[userProperty].can = roleCheck;
      if (ctx.locals && !ctx.locals[userProperty]) {
        ctx.locals[userProperty] = ctx[userProperty];
      }
    }
    ctx.userIs = ctx.userCan = roleCheck;
    return next();
  };
};

function tester(roles, ctx) {
  return action => roles.test(ctx, action);
}

function defaultFailureHandler(ctx, action) {
  const message = `Access Denied - You don't have permission to: ${action}`;
  ctx.body = ctx.accepts('json', 'html') === 'json' ? { message } : message;
  ctx.status = 403;
}
