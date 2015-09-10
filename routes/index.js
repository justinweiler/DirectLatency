var express = require('express');
var config = require('./../config.js');

var router = express.Router();

/* GET home page for browser. */
router.get(
    '/',
    function (req, res)
    {
        res.render('index', {title: 'Test Page For Browser', url: config.url});
    }
);

/* GET home page for phantom. */
router.get(
    '/ph',
    function (req, res)
    {
        res.render('indexphantom', {title: 'Test Page For Phantom', url: config.url});
    }
);

/* GET home page for dyn. */
router.get(
    '/dyn',
    function (req, res)
    {
        res.render('indexdyn', {title: 'Test Page For Dyn'});
    }
);

module.exports = router;
