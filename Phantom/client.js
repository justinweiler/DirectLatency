/**
 * Created by justinw on 8/26/15.
 */
var system      = require('system');
var fs          = require('fs');
var async       = require('./async.js');
var config      = require('./../config.js');

var i           = 0;
var id          = system.args[1];
var end         = system.args[2];
var nobid       = 0;
var failed      = 0;
var notRendered = 0;
var timeout     = 0;
var statusFail  = 0;
var bid         = 0;

var cncURL      = config.url + '/cnc';
var testPageURL = config.url + '/ph';

phantom.onError = function(msg)
{
    console.log('<' + id + '> PHANTOM ERROR: ' + msg);
    console.log('<' + id + '> terminated');
    phantom.exit(1);
};

function loopTest()
{
    if (end == 'INFINITE')
    {
        return true;
    }

    return i < end;
}

function loopFinish(err)
{
    if (err)
    {
        console.log('<' + id + '> loopFinish error: ' + err);
    }
    else
    {
        console.log('<' + id + '> Bid:', bid,
            'NoBid:', nobid,
            'Failed:', failed,
            'Not Rendered:', notRendered,
            'Timeout:', timeout,
            'Status Fail:', statusFail
        );
    }

    phantom.exit();
}

function makeId()
{
    var txid     = "ffffffffffffffff";
    var possible = "abcdef0123456789";

    for (var i = 0; i < 16; i++)
    {
        txid += possible.charAt(Math.floor(Math.random() * 16));
    }

    return txid;
}

function waitFor(page, selector, expiry, callback)
{
    var result = page.evaluate(
        function (selector)
        {
            return document.querySelector(selector);
        },
        selector
    );

    if (result)
    {
        return callback(true);
    }

    var finish = (new Date()).getTime();

    if (finish > expiry)
    {
        return callback(false);
    }

    window.setTimeout(
        function ()
        {
            waitFor(page, selector, expiry, callback);
        },
        10
    );
}

function _visitTestPage(cookie, callback)
{
    phantom.addCookie(
        {
            'name': 'NETID01',
            'value': cookie,
            'domain': '.revsci.net'
        }
    );

    var page = require('webpage').create();

    page.onError = phantom.onError;

    page.settings.userAgent = 'Grebulon';
    page.settings.resourceTimeout = 5000;

    page.onResourceTimeout = function()
    {
        timeout++;
        console.log('<' + id + '> Unable to access test page: Timeout');
        return callback();
    };

    page.open(
        testPageURL,
        function (status)
        {
            if (status !== 'success')
            {
                statusFail++;
                page.close();
                console.log('<' + id + '> Unable to access test page: Status');
                return callback();
            }
            else
            {
                return waitFor(
                    page,
                    '#testdone',
                    (new Date()).getTime() + 5000,
                    function (inTime)
                    {
                        var txidOut = page.evaluate(
                            function ()
                            {
                                return document.getElementById('tx').textContent;
                            }
                        );

                        if (inTime == false)
                        {
                            console.log('<' + id + '> Unable to finish test page: Timeout');
                            timeout++;
                        }
                        else if (~txidOut.indexOf('NOBID'))
                        {
                            nobid++;
                        }
                        else if (~txidOut.indexOf('NOTRENDERED'))
                        {
                            notRendered++;
                        }
                        else if (~txidOut.indexOf('FAILED'))
                        {
                            failed++;
                        }
                        else
                        {
                            bid++;
                        }

                        page.close();

                        //fs.write('client.log', '<' + id + '> Iteration[' + i + '] ' + txidOut + '\n', 'a+');
                        //if (i % 100 == 0)
                        //{
                        //    console.log('<' + id + '> Iteration: ' + i);
                        //}

                        callback();
                    }
                );
            }
        }
    );
}

function visitTestPageUseCNC(callback)
{
    i++;

    phantom.cookie = '';

    var cncpage = require('webpage').create();

    cncpage.onResourceTimeout = function()
    {
        console.log('<' + id + '> Unable to access cnc server: Timeout');
        return callback();
    };

    cncpage.open(
        cncURL,
        function (status)
        {
            if (status !== 'success')
            {
                statusFail++;
                cncpage.close();
                console.log('<' + id + '> Unable to access cnc server: Status');
                return callback();
            }
            else
            {
                var cookie = cncpage.evaluate(
                    function ()
                    {
                        return document.getElementById('cookie').textContent;
                    }
                );

                cncpage.close();
                _visitTestPage(cookie, callback);
            }
        }
    );
}

function visitTestPage(callback)
{
    i++;

    phantom.cookie = '';

    var cookie = makeId();

    _visitTestPage(cookie, callback);
}

async.whilst(loopTest, visitTestPage, loopFinish);