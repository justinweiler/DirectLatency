var express = require('express');
var fs = require('fs');
var async = require ('async');
var router = express.Router();

var state = {};

function resetState()
{
    state.bids      = 0;
    state.impr      = 0;
    state.nobids    = 0;
    state.fails     = 0;
    state.series    = [];

    delete state.stringSeries;
}

function capture()
{
    state.capture = true;
}

function noCapture()
{
    state.capture = false;
}

function sample(series, latency, blob, callback)
{
    var sampled = false;

    for (var i = 0; i < state.series.length; i++)
    {
        if (series == state.series[i].name)
        {
            var bin = Math.floor(latency / 10.0);

            if (bin < 0)
            {
                bin = 0;
            }
            else if (bin > 24)
            {
                bin = 25;
            }

            state.series[i].data[bin]++;
            sampled = true;

            if (state.capture)
            {
                fs.appendFile('latency.log', series + ',' + latency + ',' + blob + '\n', undefined, callback);
            }

            break;
        }
    }

    if (!sampled)
    {
        state.series.push(
            {
                name: series,
                data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
            }
        );

        sample(series, latency, blob, callback);
    }
}

resetState();
capture();

router.route('/')
.get(
    function(req, res)
    {
        var id = "ffffffffffffffff";
        var possible = "abcdef0123456789";

        for (var i = 0; i < 16; i++)
        {
            id += possible.charAt(Math.floor(Math.random() * 16));
        }

        res.render('cookie', {cookie: id});
    }
)
.post(
    function(req, res)
    {
        var result;

        if (req.body.bid)
        {
            result = ':bid';
            state.bids++;
        }
        else if (req.body.nobid)
        {
            result = ':nobid';
            state.nobids++;
        }
        else if (req.body.failed)
        {
            result = ':fail';
            state.fails++;
        }

        req.body.blob = req.body.blob || '';

        var tasks = [];

        if (req.body.pqlatency)
        {
            tasks.push(
                function (callback)
                {
                    sample(
                        req.body.source + result,
                        req.body.pqlatency,
                        req.body.blob,
                        callback
                    );
                }
            );
        }

        if (req.body.implatency)
        {
            for (var i = 0; i < req.body.implatency.length; i++)
            {
                state.impr++;
                var latency = req.body.implatency[i];

                tasks.push(
                    function (callback)
                    {
                        sample(
                            req.body.source + ':imp',
                            latency,
                            req.body.blob,
                            callback
                        );
                    }
                );
            }
        }

        async.parallel(
            tasks,
            function (err)
            {
                if (err)
                {
                    res.status = 500;
                }
                else
                {
                    state.stringSeries = JSON.stringify(state.series);
                    res.status         = 200;
                }

                res.end();
            }
        );
    }
);

router.get(
    '/status',
    function(req, res)
    {
        res.render('cnc', state);
    }
);

router.get(
    '/reset',
    function(req, res)
    {
        resetState();
        res.redirect('/cnc/status');
    }
);

router.get(
    '/capture',
    function(req, res)
    {
        capture();
        res.redirect('/cnc/status');
    }
);

router.get(
    '/nocapture',
    function(req, res)
    {
        noCapture();
        res.redirect('/cnc/status');
    }
);

module.exports = router;
