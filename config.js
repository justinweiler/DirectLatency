module.exports.out  = '/tmp/latency.log';
module.exports.port = 3000;
module.exports.host = 'http://localhost';
module.exports.url  = module.exports.host;

if (typeof module.exports.port === 'number')
{
    module.exports.port = parseInt(module.exports.port);

    if (module.exports.port != 80)
    {
        module.exports.url += ':' + module.exports.port;
    }
}
else
{
    console.log('config.js - Port must be a valid integer');
}
