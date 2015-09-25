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
    state.bids      = 0;
    state.impr      = 0;
    state.nobids    = 0;
    state.fails     = 0;
    state.series    = [];
}

function capture()
{
    cumulative.capture = true;
}

function noCapture()
{
    cumulative.capture = false;
}

function createNewArray()
{
    var array = [];

    for (var i = 0; i < maxBins; i++)
    {
        array[i] = 0;
    }

    return array;
}

function createNewSeries(state, series)
{
    var newSeries = {
            name: series,
            data: createNewArray()
        };

    state.series.push(newSeries);

    return newSeries;
}

function addStateData(aggregated, state)
{
    aggregated.bids     += state.bids;
    aggregated.impr     += state.impr;
    aggregated.nobids   += state.nobids;
    aggregated.fails    += state.fails;

    for (var i = 0; i < state.series.length; i++)
    {
        var stateSeries = state.series[i];
        var aggregatedSeries;

        for (var j = 0; j < aggregated.series.length; j++)
        {
            aggregatedSeries = aggregated.series[j];

            if (aggregatedSeries.name == stateSeries.name)
            {
                break;
            }
            else
            {
                aggregatedSeries = undefined;
            }
        }

        if (aggregatedSeries == undefined)
        {
            aggregatedSeries = createNewSeries(aggregated, stateSeries.name);
        }

        for (var j = 0; j < aggregatedSeries.data.length; j++)
        {
            aggregatedSeries.data[j] += stateSeries.data[j];
        }
    }
}

function captureData(state, series, latency, blob, callback)
{
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

            if (state.capture)
            {
                return fs.appendFile(config.out, series + ',' + latency + ',' + blob + '\n', undefined, callback);
            }
            else
            {
                return callback();
            }
        }
    }

    createNewSeries(state, series);
    captureData(state, series, latency, blob, callback);
}

function getRenderStateData(dateStart, dateEnd, series)
{
    var renderState     = createNewState();
    var useCumulative   = dateStart == 'CUMULATIVE' || dateEnd == 'CUMULATIVE';
    var start           = 0;
    var end             = heat.length - 1;

    if (useCumulative)
    {
        renderState = JSON.parse(JSON.stringify(cumulative));
    }
    else
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
    renderState.heatName    = series;
    renderState.heatData    = 'Date,Bin,Val\n';
    renderState.source      = series.split(':')[0];
    renderState.ratio       = (renderState.nobids / renderState.bids).toString().substring(0, 5);
    var nobidData = [];
    var bidData = [];
    var ratioData = [];

    var nobidSeries = renderState.source + ':nobid';
    var bidSeries = renderState.source + ':bid';

    for (var i = start; i <= end; i++)
    {
        var chunkState = heat[i];

        var normalChunkData = createNewArray();

        if (!useCumulative)
        {
            addStateData(renderState, chunkState);
        }

        for (var j = 0; j < chunkState.series.length; j++)
        {
            var chunkStateSeries = chunkState.series[j];

            if (chunkStateSeries.name == series)
            {
                var total = 0;

                for (var k = 0; k < chunkStateSeries.data.length; k++)
                {
                    total += chunkStateSeries.data[k];
                }

                for (var k = 0; k < chunkStateSeries.data.length; k++)
                {
                    normalChunkData[k] = Math.ceil((chunkStateSeries.data[k] * 100) / total);
                }

                break;
            }
        }

        for (var j = 0; j < normalChunkData.length; j++)
        {
            renderState.heatData += chunkState.date + ',' + j + ',' + normalChunkData[j] + '\n';
        }

        var totalBids = 0;
        var totalNobids = 0;

        for (var j = 0; j < chunkState.series.length; j++)
        {
            var chunkStateSeries = chunkState.series[j];

            if (chunkStateSeries.name == nobidSeries)
            {
                for (var k = 0; k < chunkStateSeries.data.length; k++)
                {
                    totalNobids += chunkStateSeries.data[k];
                }

                nobidData.push([chunkState.date, totalNobids]);
            }
            else if (chunkStateSeries.name == bidSeries)
            {
                for (var k = 0; k < chunkStateSeries.data.length; k++)
                {
                    totalBids += chunkStateSeries.data[k];
                }

                bidData.push([chunkState.date, totalBids]);
            }
        }

        ratioData.push([chunkState.date, totalNobids / totalBids])
    }

    renderState.histoData   = JSON.stringify(renderState.series);
    renderState.nobidData   = JSON.stringify(nobidData);
    renderState.bidData     = JSON.stringify(bidData);
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
    var series      = req.params.series     || 'Canary-P:bid';

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

    res.render('cnc', getRenderStateData(dateStart, dateEnd, series));
}

function postMetricsHandler(req, res)
{
    var result;

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
    else if (req.body.failed)
    {
        result = ':fail';
        cumulative.fails++;
        activeHeatState().fails++;
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
                        captureData(
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

            var latency = req.body.implatency[i];

            tasks.push(
                (function createTask(latency){
                    return function (callback)
                    {
                        async.each(
                            [cumulative, activeHeatState()],
                            function (state, eCallback)
                            {
                                captureData(
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
    '/status/:series',
    getStatusHandler
);

router.get(
    '/status/:series/:dateStart/:dateEnd',
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

/*TEST DATA
function mockData(state, i, bids, nobids)
{
    state.bids = bids + (i % 100);
    state.nobids = nobids + (i % 100);
    createNewSeries(state, 'Canary-P:bid').data[i % maxBins] = state.bids;
    createNewSeries(state, 'Canary-P:nobid').data[(i + Math.floor(maxBins / 2)) % maxBins] = state.nobids;

    return state;
}

mockData(cumulative, 0, 1111, 111);
heat.splice(0, 1);

for (var i = heatRange - 1; i >= 0; i--)
{
    mockData(addHeatState(), i, 111, 11).date -= chunkSize * 60 * 1000 * (i + 1);
}

saveAllStateData();
*/

module.exports = router;
