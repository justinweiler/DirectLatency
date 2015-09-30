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

function getSourceNames(state)
{
    var sourceNames = {};

    for (var i = 0; i < state.dataSeries.length; i++)
    {
        var testName = state.dataSeries[i].name;
        sourceNames[testName.split(':')[0]] = true;
    }

    var sourceArray = [];

    for (var sr in sourceNames)
    {
        sourceArray.push(sr);
    }

    return sourceArray;
}

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

function aggregateState(aggregatedState, state, source, stripAspects)
{
    if (!source)
    {
        aggregatedState.bid     += state.bid;
        aggregatedState.impr    += state.impr;
        aggregatedState.nobid   += state.nobid;
        aggregatedState.fail    += state.fail;
    }

    for (var i = 0; i < state.dataSeries.length; i++)
    {
        var stateDataSeries = state.dataSeries[i];

        if (stripAspects && stateDataSeries.name[stateDataSeries.name.length - 2] == ':')
        {
            continue;
        }
        else if (source)
        {
            if (stateDataSeries.name.indexOf(source + ':') != 0)
            {
                continue;
            }
            else if (stateDataSeries.name == source + ':bid')
            {
                for (var j = 0; j < stateDataSeries.data.length; j++)
                {
                    aggregatedState.bid += stateDataSeries.data[j];
                }
            }
            else if (stateDataSeries.name == source + ':nobid')
            {
                for (var j = 0; j < stateDataSeries.data.length; j++)
                {
                    aggregatedState.nobid += stateDataSeries.data[j];
                }
            }
            else if (stateDataSeries.name == source + ':fail')
            {
                for (var j = 0; j < stateDataSeries.data.length; j++)
                {
                    aggregatedState.fail += stateDataSeries.data[j];
                }
            }
            else if (stateDataSeries.name == source + ':impr')
            {
                for (var j = 0; j < stateDataSeries.data.length; j++)
                {
                    aggregatedState.impr += stateDataSeries.data[j];
                }
            }
        }

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

    return aggregatedState;
}

function resetState(state)
{
    state.bid       = 0;
    state.impr       = 0;
    state.nobid     = 0;
    state.fail      = 0;
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

function getRenderStateData(dateStart, dateEnd, name, source)
{
    var renderState     = createNewState();
    var useCumulative   = (dateStart == 'CUMULATIVE' || dateEnd == 'CUMULATIVE') && !source;
    var start           = 0;
    var end             = heat.length - 1;

    // use cumulative summary stats, start and end equal heat array bounds
    if (useCumulative)
    {
        aggregateState(renderState, cumulative, undefined, true);
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
    renderState.heatName    = name;
    renderState.sourceNames = [];
    renderState.seriesNames = [];
    renderState.heatData    = 'Date,Bin,Val\n';
    renderState.histosource = source || 'ALL';

    var nobidData   = [];
    var bidData     = [];
    var failData    = [];
    var imprData    = [];
    var ratioData   = [];

    // extract heat data for range
    for (var i = start; i <= end; i++)
    {
        var chunkState = heat[i];

        var normalChunkData = createNewDataArray();

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

        var filteredState = aggregateState(createNewState(), chunkState, source, true);

        if (!useCumulative)
        {
            aggregateState(renderState, filteredState);
        }

        nobidData.push([chunkState.date, filteredState.nobid]);
        bidData.push([chunkState.date, filteredState.bid]);
        failData.push([chunkState.date, filteredState.fail]);
        imprData.push([chunkState.date, filteredState.impr]);

        if (filteredState.bid || filteredState.nobid || filteredState.fail)
        {
            ratioData.push([chunkState.date, filteredState.bid /
                (filteredState.bid + filteredState.nobid + filteredState.fail)])
        }
        else
        {
            ratioData.push([chunkState.date, 0]);
        }
    }

    if (renderState.bid || renderState.nobid || renderState.fail)
    {
        renderState.ratio = (renderState.bid /
            (renderState.bid + renderState.nobid + renderState.fail)).toString().substring(0, 5);
    }
    else
    {
        renderState.ratio = '0.000';
    }

    renderState.sourceNames = getSourceNames(cumulative);
    renderState.histoData   = JSON.stringify(renderState.dataSeries);
    renderState.nobidData   = JSON.stringify(nobidData);
    renderState.bidData     = JSON.stringify(bidData);
    renderState.imporData   = JSON.stringify(imprData);
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
    var source      = req.params.name;

    if (name.indexOf(':') == -1)
    {
        name += ':bid';
    }

    if (source && source.indexOf(':') != -1)
    {
        source = source.split(':')[0];
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

    res.render('cnc', getRenderStateData(dateStart, dateEnd, name, source));
}

function postMetricsHandler(req, res)
{
    var result;

    // increment state statistics
    if (req.body.bid)
    {
        result = ':bid';
        cumulative.bid++;
        activeHeatState().bid++;
    }
    else if (req.body.nobid)
    {
        result = ':nobid';
        cumulative.nobid++;
        activeHeatState().nobid++;
    }
    else if (req.body.fail)
    {
        result = ':fail';
        cumulative.fail++;
        activeHeatState().fail++;
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

//TEST DATA
function mockData(state, i, bid, nobid, fail)
{
    state.bid   = bid + (i % 233);
    state.nobid = nobid + (i % 153);
    state.impr  = state.bid;
    state.fail  = fail + (i % 13);

    var bidp = Math.floor(state.bid / 2);
    var bidx = state.bid - bidp;

    var nobidp = Math.floor(state.nobid / 2);
    var nobidx = state.nobid - nobidp;

    var imprp = Math.floor(state.impr / 2);
    var imprx = state.impr - bidp;

    var failp = Math.floor(state.fail / 2);
    var failx = state.fail - bidp;
    
    createNewDataSeries(state, 'Canary-P:bid').data[(0 +  Math.floor(i / 400)) % maxBins] = bidp;
    createNewDataSeries(state, 'Canary-P:bid:d').data[(0 +  Math.floor(i / 400)) % maxBins] = bidp;
    createNewDataSeries(state, 'Canary-P:bid:c').data[(0 +  Math.floor(i / 400)) % maxBins] = bidp;
    createNewDataSeries(state, 'Canary-P:bid:r').data[(0 +  Math.floor(i / 400)) % maxBins] = bidp;

    createNewDataSeries(state, 'Canary-P:nobid').data[(1 +  Math.floor(i / 400)) % maxBins] = nobidp;
    createNewDataSeries(state, 'Canary-P:nobid:d').data[(1 +  Math.floor(i / 400)) % maxBins] = nobidp;
    createNewDataSeries(state, 'Canary-P:nobid:c').data[(1 +  Math.floor(i / 400)) % maxBins] = nobidp;
    createNewDataSeries(state, 'Canary-P:nobid:r').data[(1 +  Math.floor(i / 400)) % maxBins] = nobidp;

    createNewDataSeries(state, 'Canary-P:impr').data[(2 +  Math.floor(i / 400)) % maxBins] = imprp;
    createNewDataSeries(state, 'Canary-P:impr:d').data[(2 +  Math.floor(i / 400)) % maxBins] = imprp;
    createNewDataSeries(state, 'Canary-P:impr:c').data[(2 +  Math.floor(i / 400)) % maxBins] = imprp;
    createNewDataSeries(state, 'Canary-P:impr:r').data[(2 +  Math.floor(i / 400)) % maxBins] = imprp;

    createNewDataSeries(state, 'Canary-P:fail').data[(3 +  Math.floor(i / 400)) % maxBins] = failp;
    createNewDataSeries(state, 'Canary-P:fail:d').data[(3 +  Math.floor(i / 400)) % maxBins] = failp;
    createNewDataSeries(state, 'Canary-P:fail:c').data[(3 +  Math.floor(i / 400)) % maxBins] = failp;
    createNewDataSeries(state, 'Canary-P:fail:r').data[(3 +  Math.floor(i / 400)) % maxBins] = failp;

    createNewDataSeries(state, 'Canary-X:bid').data[(4 +  Math.floor(i / 400)) % maxBins] = bidx;
    createNewDataSeries(state, 'Canary-X:bid:d').data[(4 +  Math.floor(i / 400)) % maxBins] = bidx;
    createNewDataSeries(state, 'Canary-X:bid:c').data[(4 +  Math.floor(i / 400)) % maxBins] = bidx;
    createNewDataSeries(state, 'Canary-X:bid:r').data[(4 +  Math.floor(i / 400)) % maxBins] = bidx;

    createNewDataSeries(state, 'Canary-X:nobid').data[(5 +  Math.floor(i / 400)) % maxBins] = nobidx;
    createNewDataSeries(state, 'Canary-X:nobid:d').data[(5 +  Math.floor(i / 400)) % maxBins] = nobidx;
    createNewDataSeries(state, 'Canary-X:nobid:c').data[(5 +  Math.floor(i / 400)) % maxBins] = nobidx;
    createNewDataSeries(state, 'Canary-X:nobid:r').data[(5 +  Math.floor(i / 400)) % maxBins] = nobidx;

    createNewDataSeries(state, 'Canary-X:impr').data[(6 +  Math.floor(i / 400)) % maxBins] = imprx;
    createNewDataSeries(state, 'Canary-X:impr:d').data[(6 +  Math.floor(i / 400)) % maxBins] = imprx;
    createNewDataSeries(state, 'Canary-X:impr:c').data[(6 +  Math.floor(i / 400)) % maxBins] = imprx;
    createNewDataSeries(state, 'Canary-X:impr:r').data[(6 +  Math.floor(i / 400)) % maxBins] = imprx;
    
    createNewDataSeries(state, 'Canary-X:fail').data[(7 +  Math.floor(i / 400)) % maxBins] = failx;
    createNewDataSeries(state, 'Canary-X:fail:d').data[(7 +  Math.floor(i / 400)) % maxBins] = failx;
    createNewDataSeries(state, 'Canary-X:fail:c').data[(7 +  Math.floor(i / 400)) % maxBins] = failx;
    createNewDataSeries(state, 'Canary-X:fail:r').data[(7 +  Math.floor(i / 400)) % maxBins] = failx;

    return state;
}

// stop timer
clearInterval(chunkTimer);

// mock cumulative
cumulative = createNewState();

// mock heat
heat = [];

for (var i = heatRange - 1; i >= 0; i--)
{
    state = mockData(addHeatState(), i, 100, 10, 1);
    state.date = cumulative.date - (chunkSize * 60 * 1000 * (i + 1));
    aggregateState(cumulative, state, undefined, false);
}

module.exports = router;
