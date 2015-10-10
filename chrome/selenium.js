var webdriver = require('selenium-webdriver');

var options = new chrome.Options();
options.addArguments("load-extension=~/DirectLatency/chrome");

var driver = new webdriver.Builder()
    .usingServer('http://localhost:4444/wd/hub')
    .setChromeOptions(options)
    .withCapabilities(webdriver.Capabilities.chrome())
    .build();

driver.get('http://www.babycenter.com');

driver.wait(
    function ()
    {
        driver.getPageSource().then(
            function(html)
            {
                console.log(html);
                driver.quit();
                return true;
            }
        );
    },
    5000
);

