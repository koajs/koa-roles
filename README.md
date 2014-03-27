koa-roles
=======

[![Build Status](https://secure.travis-ci.org/fengmk2/koa-roles.png)](http://travis-ci.org/fengmk2/koa-roles) [![Dependency Status](https://gemnasium.com/fengmk2/koa-roles.png)](https://gemnasium.com/fengmk2/koa-roles)

[![NPM](https://nodei.co/npm/koa-roles.png?downloads=true&stars=true)](https://nodei.co/npm/koa-roles/)

![logo](https://raw.github.com/fengmk2/koa-roles/master/logo.png)

koa version of [connect-roles](https://github.com/ForbesLindesay/connect-roles)

## Install

```bash
$ npm install koa-roles
```

## Usage

```js
var Roles = require('koa-roles');
var koa = require('koa');
var app = koa();

var user = new Roles({
  failureHandler: function *(action) {
    // optional function to customise code that runs when
    // user fails authorisation
    this.status = 403;
    var t = this.accepts('json', 'html');
    if (t === 'json') {
      this.body = {
        message: 'Access Denied - You don\'t have permission to: ' + action
      };
    } else if (t === 'html') {
      this.render('access-denied', {action: action});
    } else {
      this.body = 'Access Denied - You don\'t have permission to: ' + action;
    }
  }
});

app.use(user.middleware());

// anonymous users can only access the home page
// returning false stops any more rules from being
// considered
user.use(function *(action) {
  return action === 'access home page';
});

// moderator users can access private page, but
// they might not be the only ones so we don't return
// false if the user isn't a moderator
user.use('access private page', function (action) {
  if (this.user.role === 'moderator') {
    return true;
  }
})

//admin users can access all pages
user.use(function (action) {
  if (this.user.role === 'admin') {
    return true;
  }
});


app.get('/', user.can('access home page'), function *(next) {
  this.render('private');
});
app.get('/private', user.can('access private page'), function *(next) {
  this.render('private');
});
app.get('/admin', user.can('access admin page'), function *(next) {
  this.render('admin');
});

app.listen(3000);
```

## License

(The MIT License)

Copyright (c) 2014 fengmk2 &lt;fengmk2@gmail.com&gt; and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
