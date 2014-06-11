TESTS = test/*.test.js
REPORTER = spec
TIMEOUT = 1000
MOCHA_OPTS =

install:
	@npm install --registry=http://registry.npm.taobao.org --disturl=http://npm.taobao.org/dist

jshint: install
	@./node_modules/.bin/jshint .

test: install
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--harmony \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		$(MOCHA_OPTS) \
		$(TESTS)

test-cov cov: install
	@NODE_ENV=test node --harmony \
		node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha \
		-- -u exports \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		$(MOCHA_OPTS) \
		$(TESTS)
	@-./node_modules/.bin/cov coverage

test-all: install jshint test cov

autod: install
	@./node_modules/.bin/autod -w --prefix "~"
	@$(MAKE) install

contributors: install
	@./node_modules/.bin/contributors -f plain -o AUTHORS

.PHONY: test
