/**
 * Created by justinw on 8/26/15.
 */
var system      = require('system');
var fs          = require('fs');
var async       = require('./async.js');
var i           = 1;
var id          = system.args[1];
var end         = system.args[2];
var nobid       = 0;
var failed      = 0;
var notRendered = 0;
var timeout     = 0;
var bid         = 0;

var cncURL      = 'http://localhost:3000/cnc';
var testPageURL = 'http://localhost:3000/ph';

function loopTest()
{
    return i <= end;
}

function loopFinish(err)
{
    if (err)
    {
        console.log(err);
    }
    else
    {
        console.log('<' + id + '> Bid:', bid, 'NoBid:', nobid, 'Failed:', failed, 'Not Rendered:', notRendered, 'Timeout:', timeout);
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
    //system.stderr.writeLine("- waitFor(" + selector + ", " + expiry + ")");

    // try and fetch the desired element from the page
    var result = page.evaluate(
        function (selector)
        {
            return document.querySelector(selector);
        },
        selector
    );

    // if desired element found then call callback
    if (result)
    {
        //system.stderr.writeLine("- trigger " + selector + " found");
        callback(true);
        return;
    }

    // determine whether timeout is triggered
    var finish = (new Date()).getTime();

    if (finish > expiry)
    {
        //system.stderr.writeLine("- timed out");
        callback(false);
        return;
    }

    // haven't timed out, haven't found object, so poll in another 100ms
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

    page.settings.userAgent = 'Grebulon';

    page.open(
        testPageURL,
        function (status)
        {
            if (status !== 'success')
            {
                page.close();
                return callback('Unable to access test page');
            }
            else
            {
                return waitFor(
                    page,
                    '#testdone',
                    (new Date()).getTime() + 30000,
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
                        //fs.write('client.log', '<' + id + '>Iteration[' + i + '] ' + txidOut + '\n', 'a+');
                        i++;
                        callback();
                    }
                );
            }
        }
    );
}

function visitTestPageUseCNC(callback)
{
    phantom.cookie = '';

    var cncpage = require('webpage').create();

    cncpage.open(
        cncURL,
        function (status)
        {
            if (status !== 'success')
            {
                cncpage.close();
                return callback('Unable to access cnc server');
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
    phantom.cookie = '';
    var cookie     = makeId();
    _visitTestPage(cookie, callback);
}

async.whilst(loopTest, visitTestPage, loopFinish);