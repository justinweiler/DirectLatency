/**
 * Created by justinw on 9/15/15.
 */
// Q: Why is this manager necessary?
// A: Phantomjs is crash happy.  We can only run a limited amount of time b4 it decides to fall over

var child_process = require('child_process');

var id  = process.argv[2];
var end = process.argv[3];

function launchPhantom(callback)
{
    var cmd = 'phantomjs client.js ' + id + ' ' + end;
    //console.log('launching ' + cmd);
    child_process.exec(cmd, undefined, callback);
}

function resubmit()
{
    setImmediate(launchPhantom, resubmit);
}

resubmit();

