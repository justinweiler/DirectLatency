var webdriver = require('selenium-webdriver');

var options = new chrome.Options();
options.addArguments("load-extension=~/DirectLatency/chrome");

var capabilities = ;

var driver = new webdriver.Builder()
    .usingServer('http://localhost:4444/wd/hub')
    .setChromeOptions(options)
    .withCapabilities(webdriver.Capabilities.chrome())
    .build();

driver.get('http://www.babycenter.com');

driver.wait(
    function ()
    {
        driver.quit();
    },
    5000
);

