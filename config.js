module.exports.out          = '/tmp/latency.log';
module.exports.port         = 3000;
module.exports.host         = 'http://localhost';
module.exports.url          = module.exports.host;
module.exports.datacenterId = '0'; // single character 0-f

module.exports.datacenters = [
    'West Coast|http://52.26.78.96/cnc/status',
    'East Coast|http://52.26.78.96/cnc/status',
    'Singapore|http://52.26.78.96/cnc/status',
    'South America|http://52.26.78.96/cnc/status',
    'Oort Cloud|http://52.26.78.96/cnc/status'
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
