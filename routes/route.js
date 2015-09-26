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
var timingsFile = './timings.json';

function createNewState()
{
    var newState = {date: Date.now()};
    resetState(newState);
    return newState;
}

function addHeatState()
{
    var newState = createNewState();
    heat.push(newState);

    if (heat.length > heatRange)
    {
        heat.splice(0, 1);
    }

    return newState;
}

function activeHeatState()
{
    return heat[heat.length - 1];
}

function resetState(state)
{
    state.bids       = 0;
    state.impr       = 0;
    state.nobids     = 0;
    state.fails      = 0;
    state.dataSeries = [];
}

function capture()
{
    cumulative.capture = true;
}

function noCapture()
{
    cumulative.capture = false;
}

function createNewDataArray()
{
    var array = [];

    for (var i = 0; i < maxBins; i++)
    {
        array[i] = 0;
    }

    return array;
}

function createNewDataSeries(state, name)
{
    var newDataSeries = {
            name: name,
            data: createNewDataArray()
        };

    state.dataSeries.push(newDataSeries);

    return newDataSeries;
}

function aggregateState(aggregatedState, state)
{
    aggregatedState.bids     += state.bids;
    aggregatedState.impr     += state.impr;
    aggregatedState.nobids   += state.nobids;
    aggregatedState.fails    += state.fails;

    for (var i = 0; i < state.dataSeries.length; i++)
    {
        var stateDataSeries = state.dataSeries[i];
        var aggregatedDataSeries;

        for (var j = 0; j < aggregatedState.dataSeries.length; j++)
        {
            aggregatedDataSeries = aggregatedState.dataSeries[j];

            if (aggregatedDataSeries.name == stateDataSeries.name)
            {
                break;
            }
            else
            {
                aggregatedDataSeries = undefined;
            }
        }

        if (aggregatedDataSeries == undefined)
        {
            aggregatedDataSeries = createNewDataSeries(aggregatedState, stateDataSeries.name);
        }

        for (var j = 0; j < aggregatedDataSeries.data.length; j++)
        {
            aggregatedDataSeries.data[j] += stateDataSeries.data[j];
        }
    }
}

function accumulateTrackedDataSeries(state, rootName, latencyRecord, blob, callback)
{
    for (var aspect in latencyRecord)
    {
        var aspectName = undefined;
        var latency = latencyRecord[aspect];

        switch (aspect)
        {
            case 'duration':    aspectName = rootName;          break;
            case 'dns':         aspectName = rootName + ':d';   break;
            case 'connection':  aspectName = rootName + ':c';   break;
            case 'response':    aspectName = rootName + ':r';   break;
            default:                                            break;
        }

        if (aspectName)
        {
            accumulateDataSeries(state, aspectName, latency);
        }
    }

    if (state.capture)
    {
        return fs.appendFile(
            config.out, 
            rootName + ',' +
            JSON.stringify(latencyRecord) + ',' + 
            blob + '\n', 
            undefined, 
            callback);
    }
    else
    {
        return callback();
    }
}

function accumulateDataSeries(state, name, latency)
{
    for (var i = 0; i < state.dataSeries.length; i++)
    {
        if (name == state.dataSeries[i].name)
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

            state.dataSeries[i].data[bin]++;

            return;
        }
    }

    createNewDataSeries(state, name);
    accumulateDataSeries(state, name, latency);
}

function getRenderStateData(dateStart, dateEnd, name)
{
    var renderState     = createNewState();
    var useCumulative   = dateStart == 'CUMULATIVE' || dateEnd == 'CUMULATIVE';
    var start           = 0;
    var end             = heat.length - 1;

    // use cumulative summary stats, start and end equal heat array bounds
    if (useCumulative)
    {
        renderState = JSON.parse(JSON.stringify(cumulative));
    }
    else // figure out date range indices, start and end may differ from heat array bounds
    {
        var foundStart = false;

        for (var i = 0; i < heat.length; i++)
        {
            var chunkDate = heat[i].date;

            if (!foundStart && dateStart < chunkDate)
            {
                start = i - 1;
                foundStart = true;
            }
            else if (dateEnd <= chunkDate)
            {
                end = i - 1;
                break;
            }
        }

        if (start < 0)
        {
            start = 0;
        }

        if (end < start)
        {
            end = start;
        }
    }

    renderState.dateStart   = heat[start].date;
    renderState.dateEnd     = heat[end].date;
    renderState.capture     = cumulative.capture;
    renderState.binSize     = binSize;
    renderState.maxBins     = maxBins;
    renderState.chunkSize   = chunkSize;
    renderState.cumulative  = useCumulative;
    renderState.heatName    = name;
    renderState.heatData    = 'Date,Bin,Val\n';
    renderState.source      = name.split(':')[0];

    if (renderState.bids || renderState.nobids)
    {
        renderState.ratio = (renderState.nobids / (renderState.bids + renderState.nobids)).toString().substring(0, 5);
    }
    else
    {
        renderState.ratio = '0.000';
    }

    var nobidData = [];
    var bidData = [];
    var failData = [];
    var ratioData = [];
    var histoData = [];

    var nobidSeriesName = renderState.source + ':nobid';
    var bidSeriesName = renderState.source + ':bid';
    var failSeriesName = renderState.source + ':fail';

    // extract histo data for durations where aspect series like (-d, -c, -r) is excluded
    for (var i = 0; i < renderState.dataSeries.length; i++)
    {
        var testName = renderState.dataSeries[i].name;

        if (testName.indexOf(':bid:') == -1 &&
            testName.indexOf(':nobid:') == -1 &&
            testName.indexOf(':fail:') == -1)
        {
            histoData.push(renderState.dataSeries[i]);
        }
    }

    // extract heat data for range
    for (var i = start; i <= end; i++)
    {
        var chunkState = heat[i];

        var normalChunkData = createNewDataArray();

        // if not using cumulative then
        //      grab summary stats over range
        // else
        //      render state already contains everything recorded by cumulative state
        if (!useCumulative)
        {
            aggregateState(renderState, chunkState);
        }

        // normalize each chunk in target series
        for (var j = 0; j < chunkState.dataSeries.length; j++)
        {
            var chunkDataSeries = chunkState.dataSeries[j];

            if (chunkDataSeries.name == name)
            {
                var total = 0;

                for (var k = 0; k < chunkDataSeries.data.length; k++)
                {
                    total += chunkDataSeries.data[k];
                }

                for (var k = 0; k < chunkDataSeries.data.length; k++)
                {
                    normalChunkData[k] = Math.ceil((chunkDataSeries.data[k] * 100) / total);
                }

                break;
            }
        }

        // append heat data string
        for (var j = 0; j < normalChunkData.length; j++)
        {
            renderState.heatData += chunkState.date + ',' + j + ',' + normalChunkData[j] + '\n';
        }

        var totalBids = 0;
        var totalNobids = 0;
        var totalFails = 0;

        // extract bid, nobid and ratio data for range
        for (var j = 0; j < chunkState.dataSeries.length; j++)
        {
            var chunkDataSeries = chunkState.dataSeries[j];

            if (chunkDataSeries.name == nobidSeriesName)
            {
                for (var k = 0; k < chunkDataSeries.data.length; k++)
                {
                    totalNobids += chunkDataSeries.data[k];
                }

                nobidData.push([chunkState.date, totalNobids]);
            }
            else if (chunkDataSeries.name == bidSeriesName)
            {
                for (var k = 0; k < chunkDataSeries.data.length; k++)
                {
                    totalBids += chunkDataSeries.data[k];
                }

                bidData.push([chunkState.date, totalBids]);
            }
            else if (chunkDataSeries.name == failSeriesName)
            {
                for (var k = 0; k < chunkDataSeries.data.length; k++)
                {
                    totalFails += chunkDataSeries.data[k];
                }

                failData.push([chunkState.date, totalFails]);
            }
        }

        if (totalBids || totalNobids)
        {
            ratioData.push([chunkState.date, totalNobids / (totalBids + totalNobids)])
        }
        else
        {
            ratioData.push([chunkState.date, 0]);
        }
    }

    renderState.histoData   = JSON.stringify(histoData);
    renderState.nobidData   = JSON.stringify(nobidData);
    renderState.bidData     = JSON.stringify(bidData);
    renderState.failData    = JSON.stringify(failData);
    renderState.ratioData   = JSON.stringify(ratioData);

    return renderState;
}

function saveAllStateData()
{
    fs.writeFile(
        timingsFile,
        JSON.stringify(
            {
                cumulative: cumulative,
                heat: heat
            }
        ),
        function (err)
        {
            if (err)
            {
                console.log('Timings save error: ' + err);
            }
        }
    );
}

function loadAllStateData()
{
    if (fs.existsSync(timingsFile))
    {
        var savedJSON = fs.readFileSync(timingsFile);
        var savedObj = JSON.parse(savedJSON);
        cumulative = savedObj.cumulative;
        heat = savedObj.heat;
    }
}

function getStatusHandler(req, res)
{
    var dateStart   = req.params.dateStart  || 'CUMULATIVE';
    var dateEnd     = req.params.dateEnd    || dateStart;
    var name        = req.params.name       || 'Canary-P:bid';

    if (name.indexOf(':') == -1)
    {
        name += ':bid';
    }

    if (dateEnd == 'now')
    {
        dateEnd = Date.now();
    }
    else if (dateEnd != 'CUMULATIVE')
    {
        dateEnd = Date.parse(dateEnd + 'Z');
    }

    if (dateStart != 'CUMULATIVE')
    {
        dateStart = Date.parse(dateStart + 'Z');
    }

    res.render('cnc', getRenderStateData(dateStart, dateEnd, name));
}

function postMetricsHandler(req, res)
{
    var result;

    // increment state statistics
    if (req.body.bid)
    {
        result = ':bid';
        cumulative.bids++;
        activeHeatState().bids++;
    }
    else if (req.body.nobid)
    {
        result = ':nobid';
        cumulative.nobids++;
        activeHeatState().nobids++;
    }
    else if (req.body.fail)
    {
        result = ':fail';
        cumulative.fails++;
        activeHeatState().fails++;
    }
    else
    {
        res.status = 500;
        return res.end('invalid post');
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
                        accumulateTrackedDataSeries(
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
            cumulative.impr++;
            activeHeatState().impr++;

            var implatency = req.body.implatency[i];

            tasks.push(
                (function createTask(implatency){
                    return function (callback)
                    {
                        async.each(
                            [cumulative, activeHeatState()],
                            function (state, eCallback)
                            {
                                accumulateTrackedDataSeries(
                                    state,
                                    req.body.source + ':imp',
                                    implatency,
                                    req.body.blob,
                                    eCallback
                                );
                            },
                            callback
                        );
                    }
                })(implatency)
            );
        }
    }

    async.parallel(
        tasks,
        function (err)
        {
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

function compositeHandler(req, res)
{
    res.render('composite', {datacenters: config.datacenters});
}

function getIdCookieHandler(req, res)
{
    var id = "fffffffffffffff" + config.datacenterId;
    var possible = "abcdef0123456789";

    for (var i = 0; i < 16; i++)
    {
        id += possible.charAt(Math.floor(Math.random() * 16));
    }

    res.render('cookie', {cookie: id});
}

function resetStateHandler(req, res)
{
    clearInterval(chunkTimer);
    resetState(cumulative);
    heat = [];
    addHeatState();
    chunkTimer = setInterval(addHeatState, chunkSize * 60 * 1000);
    res.redirect('/cnc/status');
    fs.unlinkSync(timingsFile);
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

capture();
addHeatState();
loadAllStateData();

router.route('/')
    .get(getIdCookieHandler)
    .post(postMetricsHandler);

router.get(
    '/status/:name',
    getStatusHandler
);

router.get(
    '/status/:name/:dateStart/:dateEnd',
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

router.get(
    '/composite',
    compositeHandler
);

var chunkTimer = setInterval(
    function()
    {
        addHeatState();
        saveAllStateData();
    },
    chunkSize * 60 * 1000
);

/*
//TEST DATA
function mockData(state, i, bids, nobids)
{
    state.bids = bids + (i % 100);
    state.nobids = nobids + (i % 100);
    state.fails = 77;
    createNewDataSeries(state, 'Canary-P:bid').data[i % maxBins] = state.bids;
    createNewDataSeries(state, 'Canary-P:bid:d').data[i % maxBins] = state.bids;
    createNewDataSeries(state, 'Canary-P:bid:c').data[i % maxBins] = state.bids;
    createNewDataSeries(state, 'Canary-P:bid:r').data[i % maxBins] = state.bids;

    createNewDataSeries(state, 'Canary-P:nobid').data[(i + Math.floor(maxBins / 2)) % maxBins] = state.nobids;
    createNewDataSeries(state, 'Canary-P:nobid:d').data[(i + Math.floor(maxBins / 2)) % maxBins] = state.nobids;
    createNewDataSeries(state, 'Canary-P:nobid:c').data[(i + Math.floor(maxBins / 2)) % maxBins] = state.nobids;
    createNewDataSeries(state, 'Canary-P:nobid:r').data[(i + Math.floor(maxBins / 2)) % maxBins] = state.nobids;

    createNewDataSeries(state, 'Canary-P:fail').data[(i + Math.floor(maxBins / 3)) % maxBins] = state.fails;
    createNewDataSeries(state, 'Canary-P:fail:d').data[(i + Math.floor(maxBins / 3)) % maxBins] = state.fails;
    createNewDataSeries(state, 'Canary-P:fail:c').data[(i + Math.floor(maxBins / 3)) % maxBins] = state.fails;
    createNewDataSeries(state, 'Canary-P:fail:r').data[(i + Math.floor(maxBins / 3)) % maxBins] = state.fails;

    return state;
}

// mock cumulative
cumulative = createNewState();
mockData(cumulative, 0, 1111, 111);

// mock heat
heat = [];
for (var i = heatRange - 1; i >= 0; i--)
{
    mockData(addHeatState(), i, 111, 11).date -= chunkSize * 60 * 1000 * (i + 1);
}
*/

module.exports = router;
