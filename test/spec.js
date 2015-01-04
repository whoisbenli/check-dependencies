'use strict';

/* eslint-disable no-undef */
var chalk = require('chalk'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs-extra')),
    semver = require('semver'),
    assert = require('assert'),
    checkDependencies = require('../lib/check-dependencies');
/* eslint-enable no-undef */

describe('checkDependencies', function () {
    beforeEach(function () {
        chalk.enabled = false;
    });

    function testSuite(packageManager) {
        var checkDeps, depsJsonName, packageJsonName, depsDirName,
            errorsForNotOk, pruneAndInstallMessage, fixturePrefix;

        if (packageManager === 'bower') {
            packageJsonName = 'bower.json';
            depsJsonName = '.bower.json';
            depsDirName = 'bower_components';
            fixturePrefix = './test/bower-fixtures/generated/';
            checkDeps = function checkDependenciesBower() {
                var args = [].slice.call(arguments),
                    config = arguments[0];
                if (typeof config === 'function') {
                    config = {};
                    args.unshift(config);
                }
                config.packageManager = 'bower';
                return checkDependencies.apply(null, args);
            };
        } else {
            packageJsonName = 'package.json';
            depsJsonName = 'package.json';
            depsDirName = 'node_modules';
            fixturePrefix = './test/npm-fixtures/';
            checkDeps = checkDependencies;
        }

        errorsForNotOk = [
            'a: installed: 1.2.4, expected: 1.2.3',
            'b: installed: 0.9.9, expected: >=1.0.0',
            'c: not installed!',
            'd: not installed!',
            'Invoke ' + packageManager + ' install to install missing packages',
        ];

        pruneAndInstallMessage = 'Invoke ' + packageManager + ' prune and ' +
            packageManager + ' install to install missing packages and remove ' +
            'excessive ones';


        it('should not print errors for valid package setup', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'ok',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should error on invalid package setup', function (done) {
            checkDeps({
                checkGitUrls: true,
                packageDir: fixturePrefix + 'not-ok',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, errorsForNotOk);
                done();
            });
        });

        it('should accept `scopeList` parameter', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'not-ok',
                scopeList: ['devDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should find ' + packageJsonName + ' if `packageDir` not provided', function (done) {
            checkDeps({}, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should error if ' + packageJsonName + ' wasn\'t found in `packageDir`', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'missing-json',
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.deepEqual(output.error, [
                    'Missing ' + packageJsonName + '!',
                ]);
                done();
            });
        });

        it('should ignore excessive deps if `onlySpecified` not provided', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'only-specified-not-ok',
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should ignore excessive deps if `onlySpecified` is `false`', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'only-specified-not-ok',
                onlySpecified: false,
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should not error if no excessive deps and `onlySpecified` is `true`', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'ok',
                onlySpecified: true,
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should accept packages in `optionalScopeList` when `onlySpecified` is `true`', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'only-specified-not-ok',
                onlySpecified: true,
                scopeList: ['dependencies'],
                optionalScopeList: ['fakeDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should error if there are excessive deps and `onlySpecified` is `true`', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'only-specified-not-ok',
                onlySpecified: true,
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.deepEqual(output.error, [
                    'Package c installed, though it shouldn\'t be',
                    pruneAndInstallMessage,
                ]);
                done();
            });
        });

        it('should throw if callback not provided', function () {
            assert.throws(function () {
                checkDeps({
                    packageDir: fixturePrefix + 'not-ok',
                    scopeList: ['dependencies', 'devDependencies'],
                    install: false,
                });
            });
        });

        if (packageManager === 'npm') {
            it('should allow to provide callback as the first argument', function (done) {
                checkDeps(function (output) {
                    assert.strictEqual(output.status, 0);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.deepEqual(output.error, []);
                    done();
                });
            });
        }

        it('should support `log` and `error` options', function (done) {
            var logArray = [], errorArray = [];
            checkDeps({
                checkGitUrls: true,
                packageDir: fixturePrefix + 'not-ok',
                verbose: true,
                log: function (msg) {
                    logArray.push(msg);
                },
                error: function (msg) {
                    errorArray.push(msg);
                },
            }, function (output) {
                // output.error shouldn't be silenced
                assert.deepEqual(output.error, errorsForNotOk);

                assert.deepEqual(logArray, output.log);
                assert.deepEqual(errorArray, output.error);
                done();
            });
        });

        it('should not print logs when `verbose` is not set to true', function (done) {
            var logArray = [], errorArray = [];
            checkDeps({
                packageDir: fixturePrefix + 'not-ok',
                log: function (msg) {
                    logArray.push(msg);
                },
                error: function (msg) {
                    errorArray.push(msg);
                },
            }, function () {
                assert.deepEqual(logArray, []);
                assert.deepEqual(errorArray, []);
                done();
            });
        });

        if (packageManager === 'bower') {
            it('should respect `directory` setting in `.bowerrc`', function (done) {
                checkDeps({
                    packageDir: './test/bower-fixtures/bowerrc/',
                }, function (output) {
                    assert.strictEqual(output.status, 0);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.deepEqual(output.error, []);
                    done();
                });
            });
        }

        it('should check Git URL based dependencies only if `checkGitUrls` is true', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'git-urls',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.deepEqual(output.error, [
                    'b: not installed!',
                    'Invoke ' + packageManager + ' install to install missing packages',
                ]);
            });
            checkDeps({
                checkGitUrls: true,
                packageDir: fixturePrefix + 'git-urls',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.deepEqual(output.error, [
                    'a: installed: 0.5.8, expected: 0.5.9',
                    'b: not installed!',
                    'Invoke ' + packageManager + ' install to install missing packages',
                ]);
                done();
            });
        });

        it('should check the version for Git URLs with valid semver tags only', function (done) {
            checkDeps({
                checkGitUrls: true,
                packageDir: fixturePrefix + 'non-semver-tag',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.depsWereOk, true);
                done();
            });
        });

        it('should check a Git dependency is installed even if it\'s hash ' +
            'is not a valid semver tag', function (done) {
            checkDeps({
                checkGitUrls: true,
                packageDir: fixturePrefix + 'non-semver-tag-pkg-missing',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, [
                    'a: not installed!',
                    'Invoke ' + packageManager + ' install to install missing packages',
                ]);
                done();
            });
        });

        it('should accept `latest` as a version', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'latest-ok',
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should report missing package even if version is `latest`', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'latest-not-ok',
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, [
                    'a: not installed!',
                    'Invoke ' + packageManager + ' install to install missing packages',
                ]);
                done();
            });
        });

        it('should install missing packages when `install` is set to true', function (done) {
            this.timeout(30000);

            var fixtureName = 'not-ok-install',
                versionRange = require('../' + fixturePrefix + fixtureName + '/' + packageJsonName)
                    .dependencies.jquery,
                fixtureDir = __dirname + '/../' + fixturePrefix + fixtureName,
                fixtureCopyDir = fixtureDir + '-copy',
                depVersion = JSON.parse(fs.readFileSync(__dirname +
                    '/../' + fixturePrefix + fixtureName + '/' + depsDirName +
                    '/jquery/' + depsJsonName)).version;

            assert.equal(semver.satisfies(depVersion, versionRange),
                false, 'Expected version ' + depVersion + ' not to match ' + versionRange);

            fs.removeAsync(fixtureCopyDir)
                .then(function () {
                    return fs.copyAsync(fixtureDir, fixtureCopyDir);
                })
                .then(function () {
                    checkDeps({
                        packageDir: fixturePrefix + fixtureName + '-copy',
                        checkGitUrls: true,
                        install: true,
                    }, function (output) {
                        // The functions is supposed to not fail because it's instructed to do
                        // `npm install`/`bower install`.
                        assert.strictEqual(output.status, 0);
                        assert.strictEqual(output.depsWereOk, false);
                        assert.deepEqual(output.error, [
                            'jquery: installed: 1.11.1, expected: <=1.11.0',
                            'json3: installed: 0.8.0, expected: 3.3.2',
                        ]);
                        depVersion = JSON.parse(fs.readFileSync(fixtureCopyDir + '/' + depsDirName +
                            '/jquery/' + depsJsonName)).version;
                        assert(semver.satisfies(depVersion, versionRange),
                            'Expected version ' + depVersion + ' to match ' + versionRange);
                        done();
                    });
                })
                .catch(function (error) {
                    assert.equal(error, null);
                });
        });

        it('should prune excessive packages when `install` is set to true', function (done) {
            this.timeout(30000);

            var fixtureName = 'only-specified-not-ok-install',
                fixtureDir = __dirname + '/../' + fixturePrefix + fixtureName,
                fixtureCopyDir = fixtureDir + '-copy',
                packageDir = fixturePrefix + fixtureName + '-copy';


            fs.removeAsync(fixtureCopyDir)
                .then(function () {
                    return fs.copyAsync(fixtureDir, fixtureCopyDir);
                })
                .then(function () {
                    var depList = fs.readdirSync(packageDir + '/' + depsDirName);
                    assert.deepEqual(depList,
                        ['jquery', 'json3'],
                        'Expected package json3 to be present; got: ' + JSON.stringify(depList));

                    checkDeps({
                        packageDir: packageDir,
                        onlySpecified: true,
                        checkGitUrls: true,
                        install: true,
                    }, function (output) {
                        // The functions is supposed to not fail because it's instructed to do
                        // `npm install`/`bower install`.
                        assert.strictEqual(output.status, 0);
                        assert.strictEqual(output.depsWereOk, false);
                        assert.deepEqual(output.error, [
                            'Package json3 installed, though it shouldn\'t be',
                        ]);

                        var depList = fs.readdirSync(packageDir + '/' + depsDirName);
                        assert.deepEqual(depList,
                            ['jquery'],
                            'Expected package json3 to be removed; got: ' + JSON.stringify(depList));

                        done();
                    });
                })
                .catch(function (error) {
                    assert.equal(error, null);
                });
        });
    }


    it('should prepare fixures for Bower successfully', function () {
        var npmFixturesDir = __dirname + '/npm-fixtures',
            generatedDir = __dirname + '/bower-fixtures/generated';

        return fs.removeAsync(generatedDir)
            .then(function () {
                return fs.copyAsync(npmFixturesDir, generatedDir);
            })
            .then(function () {
                return fs.readdirAsync(generatedDir);
            })
            .then(function (fixtureDirNames) {
                var tasks = [];
                fixtureDirNames.forEach(function (fixtureDirName) {
                    tasks.push(convertToBowerFixture(generatedDir + '/' + fixtureDirName));
                });
                return Promise.all(tasks);
            });

        function convertToBowerFixture(fixtureDirPath) {
            return Promise.all([])
                // Change package.json to bower.json in top level scope
                .then(function () {
                    if (fs.existsSync(fixtureDirPath + '/package.json')) {
                        return fs.moveAsync(fixtureDirPath + '/package.json',
                            fixtureDirPath + '/bower.json');
                    }
                })

                // Change node_modules to bower_components in top level scope
                .then(function () {
                    if (fs.existsSync(fixtureDirPath + '/node_modules')) {
                        return fs.moveAsync(fixtureDirPath + '/node_modules',
                            fixtureDirPath + '/bower_components');
                    }
                })

                // Change package.json to .bower.json in dependencies' folders
                .then(function () {
                    if (fs.existsSync(fixtureDirPath + '/bower_components')) {
                        return fs.readdirAsync(fixtureDirPath + '/bower_components');
                    }
                    return [];
                })
                .then(function (depDirNames) {
                    return depDirNames.map(function (depDirName) {
                        return fixtureDirPath + '/bower_components/' + depDirName;
                    });
                })
                .then(function (depDirPaths) {
                    var tasks = [];
                    depDirPaths.forEach(function (depDirPath) {
                        tasks.push(fs.moveAsync(depDirPath + '/package.json',
                            depDirPath + '/.bower.json'));
                    });
                    return Promise.all(tasks);
                });
        }
    });

    describe('npm', function () {
        testSuite('npm');
    });


    describe('bower', function () {
        testSuite('bower');
    });
});
