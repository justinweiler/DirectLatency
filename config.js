module.exports.out          = '/mnt/metrics/latency.log';
module.exports.port         = 3000;
module.exports.host         = 'http://localhost';
module.exports.url          = module.exports.host;
module.exports.datacenterId = '0'; // single character 0-f

module.exports.datacenters = [
    'Oregon|http://52.26.78.96/cnc/status',
    'Singapore|http://54.254.201.180/cnc/status',
    'Frankfurt|http://52.28.93.207/cnc/status',
    'Sao Paulo|http://54.207.29.97/cnc/status',
    'Virginia|http://52.23.201.66/cnc/status',
    'California|http://54.215.214.89/cnc/status'
];

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
