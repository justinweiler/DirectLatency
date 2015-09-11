var express = require('express');
var fs = require('fs');
var async = require('async');
var config = require('./../config.js');

var router = express.Router();

var cumulative = createNewState();
var heat = [];

var chunkSize   = 10; // make sure this is evenly divisible into 60
var binSize     = 10; // millisecond
var maxBins     = 26;
var maxDays     = 7;
var hourChunks  = 60 / chunkSize;
var heatRange   = maxDays * 24 * hourChunks;

function createNewState()
{
    return {date: Date.now()};
}

function addHeatState()
{
    var newState = createNewState();
    resetState(newState);
    heat.push(newState);

    if (heat.length > heatRange)
    {
        heat.splice(0, 1);
    }
}

function activeHeatState()
{
    return heat[heat.length - 1];
}

function resetState(state)
{
    state.bids      = 0;
    state.impr      = 0;
    state.nobids    = 0;
    state.fails     = 0;
    state.series    = [];
}

function capture(state)
{
    state.capture = true;
}

function noCapture(state)
{
    state.capture = false;
}

function createNewArray()
{
    var array = [];

    for (var i = 0; i <= maxBins; i++)
    {
        array[i] = 0;
    }

    return array;
}

function createNewSeries(series, state)
{
    var newSeries = {
            name: series,
            data: createNewArray()
        };

    state.series.push(newSeries);
    return newSeries;
}

function addStateData(cumulative, state)
{
    cumulative.bids += state.bids;
    cumulative.impr += state.impr;
    cumulative.nobids += state.nobids;
    cumulative.fails += state.fails;

    for (var i = 0; i < state.series.length; i++)
    {
        var stateSeries = state.series[i];
        var cumulativeSeries;

        for (var j = 0; j < cumulative.series.length; j++)
        {
            cumulativeSeries = cumulative.series[j];

            if (cumulativeSeries.name == stateSeries.name)
            {
                break;
            }
            else
            {
                cumulativeSeries = undefined;
            }
        }

        if (cumulativeSeries == undefined)
        {
            cumulativeSeries = createNewSeries(stateSeries.name, cumulative);
        }

        for (var j = 0; j < cumulativeSeries.data.length; j++)
        {
            cumulativeSeries.data[j] += stateSeries.data[j];
        }
    }
}

function sample(state, series, latency, blob, callback)
{
    var sampled = false;

    for (var i = 0; i < state.series.length; i++)
    {
        if (series == state.series[i].name)
        {
            var bin = Math.floor(latency / binSize);

            if (bin < 0)
            {
                bin = 0;
            }
            else if (bin > maxBins - 2)
            {
                bin = maxBins - 1;
            }

            state.series[i].data[bin]++;
            sampled = true;

            if (state.capture)
            {
                fs.appendFile(config.out, series + ',' + latency + ',' + blob + '\n', undefined, callback);
            }

            break;
        }
    }

    if (!sampled)
    {
        createNewSeries(series, state);
        sample(state, series, latency, blob, callback);
    }
}

function getRenderStateData(hourStart, hourEnd, series)
{
    var sep = '&#13;';
    var renderState = {};
    resetState(renderState);

    if (hourStart == 'CUMULATIVE')
    {
        hourStart = Math.ceil(heat.length / hourChunks);
        hourEnd = 0;

        renderState = JSON.parse(JSON.stringify(cumulative));
    }

    renderState.series      = series;
    renderState.capture     = cumulative.capture;
    renderState.binSize     = binSize;
    renderState.maxBins     = maxBins;

    var start = heat.length + hourStart * hourChunks;
    var end = heat.length + hourEnd * hourChunks;

    if (start < 0)
    {
        start = 0;
    }

    if (end < start)
    {
        end = start;
    }

    if (start >= heat.length)
    {
        start = heat.length - 1;
    }

    if (end >= heat.length)
    {
        end = heat.length - 1;
    }

    renderState.heatData = 'Date,Bin,Val' + sep;

    for (var i = start; i <= end; i++)
    {
        var chunkState = heat[i];

        var normalChunkData = createNewArray();

        if (hourStart != 'CUMULATIVE')
        {
            if (i == start)
            {
                renderState.dateStart = chunkState.date;
            }
            else if (i == end - 1)
            {
                renderState.dateEnd = chunkState.date;
            }

            addStateData(renderState, chunkState);
        }

        for (var j = 0; j < chunkState.series.length; j++)
        {
            var chunkStateSeries = chunkState.series[j];

            if (chunkStateSeries.name == series)
            {
                var max = 0;

                for (var k = 0; k < chunkStateSeries.data.length; k++)
                {
                    if (chunkStateSeries.data[k] > max)
                    {
                        max = chunkStateSeries.data[k];
                    }
                }

                for (var k = 0; k < chunkStateSeries.data.length; k++)
                {
                    normalChunkData[k] = Math.ceil((chunkStateSeries.data[k] * 100) / max);
                }

                break;
            }
        }

        for (var j = 0; j < normalChunkData.length; j++)
        {
            renderState.heatData += chunkState.date + ',' + j + ',' + normalChunkData[j] + sep;
        }
    }

    renderState.histoData = JSON.stringify(renderState.series);

    return renderState;
}

function getStatusHandler(req, res)
{
    var hourStart   = req.params.hourStart  || 'CUMULATIVE';
    var hourEnd     = req.params.hourEnd    || hourStart;
    var series      = req.params.series     || 'Canary-P:bid';

    res.render('cnc', getRenderStateData(hourStart, hourEnd, series));
}

function postMetricsHandler(req, res)
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
                async.each(
                    [cumulative, activeHeatState()],
                    function (state, eCallback)
                    {
                        sample(
                            state,
                            req.body.source + result,
                            req.body.pqlatency,
                            req.body.blob,
                            eCallback
                        );
                    },
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
                (function createTask(latency){
                    return function (callback)
                    {
                        async.each(
                            [cumulative, activeHeatState()],
                            function (state, eCallback)
                            {
                                sample(
                                    state,
                                    req.body.source + ':imp',
                                    latency,
                                    req.body.blob,
                                    eCallback
                                );
                            },
                            callback
                        );
                    }
                })(latency)
            );
        }
    }

    async.parallel(
        tasks,
        function (err)
        {
            state.stringSeries = JSON.stringify(state.series);

            if (err)
            {
                console.log(err.toString());
                res.status = 500;
            }
            else
            {
                res.status = 200;
            }

            res.end();
        }
    );
}

function getIdCookieHandler(req, res)
{
    var id = "ffffffffffffffff";
    var possible = "abcdef0123456789";

    for (var i = 0; i < 16; i++)
    {
        id += possible.charAt(Math.floor(Math.random() * 16));
    }

    res.render('cookie', {cookie: id});
}

function resetStateHandler(req, res)
{
    resetState();
    res.redirect('/cnc/status');
}

function setCaptureHandler(req, res)
{
    capture();
    res.redirect('/cnc/status');
}

function setNoCaptureHandler(req, res)
{
    noCapture();
    res.redirect('/cnc/status');
}

//////////////////////

resetState(cumulative);
capture(cumulative);
addHeatState();
setInterval(addHeatState, chunkSize * 60 * 1000);

router.route('/')
    .get(getIdCookieHandler)
    .post(postMetricsHandler);

router.get(
    '/status/:hourStart/:hourEnd/:series',
    getStatusHandler
);

router.get(
    '/status',
    getStatusHandler
);

router.get(
    '/reset',
    resetStateHandler
);

router.get(
    '/capture',
    setCaptureHandler
);

router.get(
    '/nocapture',
    setNoCaptureHandler
);

module.exports = router;
