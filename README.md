koa-roles
=======

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Gittip][gittip-image]][gittip-url]
[![David deps][david-image]][david-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/koa-roles.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa-roles
[travis-image]: https://img.shields.io/travis/koajs/koa-roles.svg?style=flat-square
[travis-url]: https://travis-ci.org/koajs/koa-roles
[coveralls-image]: https://img.shields.io/coveralls/koajs/koa-roles.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/koajs/koa-roles?branch=master
[gittip-image]: https://img.shields.io/gittip/fengmk2.svg?style=flat-square
[gittip-url]: https://www.gittip.com/fengmk2/
[david-image]: https://img.shields.io/david/koajs/koa-roles.svg?style=flat-square
[david-url]: https://david-dm.org/koajs/koa-roles
[download-image]: https://img.shields.io/npm/dm/koa-roles.svg?style=flat-square
[download-url]: https://npmjs.org/package/koa-roles

koa version of [connect-roles](https://github.com/ForbesLindesay/connect-roles)

## Install

```bash
$ npm install koa-roles
```

## Usage

```js
const Roles = require('koa-roles');
const koa = require('koa');
const app = new koa();

const user = new Roles({
  async failureHandler(ctx, action) {
    // optional function to customise code that runs when
    // user fails authorisation
    ctx.status = 403;
    var t = ctx.accepts('json', 'html');
    if (t === 'json') {
      ctx.body = {
        message: 'Access Denied - You don\'t have permission to: ' + action
      };
    } else if (t === 'html') {
      ctx.render('access-denied', {action: action});
    } else {
      ctx.body = 'Access Denied - You don\'t have permission to: ' + action;
    }
  }
});

app.use(user.middleware());

// anonymous users can only access the home page
// returning false stops any more rules from being
// considered
user.use(async (ctx, action) => {
  return ctx.user || action === 'access home page';
});

// moderator users can access private page, but
// they might not be the only ones so we don't return
// false if the user isn't a moderator
user.use('access private page', ctx => {
  if (ctx.user.role === 'moderator') {
    return true;
  }
})

//admin users can access all pages
user.use((ctx, action) => {
  if (ctx.user.role === 'admin') {
    return true;
  }
});

app.get('/', user.can('access home page'), async ctx => {
  await ctx.render('private');
});
app.get('/private', user.can('access private page'), async ctx => {
  await ctx.render('private');
});
app.get('/admin', user.can('access admin page'), async ctx => {
  await ctx.render('admin');
});

app.listen(3000);
```

## License

[MIT](LICENSE.txt)
