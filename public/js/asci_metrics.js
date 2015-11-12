if (Math.floor(Math.random() * 100) >= 0)  // TODO: SET SAMPLING RATE, CURRENTLY 100%
{
    setTimeout(
        function ()
        {
            var post = {source: 'Canary-MX'}; // TODO: SET SOURCE ID

            if (typeof asiPlacements != "undefined")
            {
                // grab placement
                for (asiPlacement in asiPlacements)
                {
                    asiBlob = asiPlacements[asiPlacement].blob;

                    if (typeof asiBlob != "undefined")
                    {
                        post.bid = true;
                        post.blob = asiBlob;
                    }
                    break;
                }

                if (post.bid == undefined)
                {
                    post.nobid = true;
                }
            }

            if (post.bid == undefined && post.nobid == undefined)
            {
                post.fail = true;
            }

            var resourceList = window.performance.getEntries();

            for (var i = 0; i < resourceList.length; i++)
            {
                if (~resourceList[i].name.indexOf('pq-direct.revsci.net'))  // TODO: SET FILTERS
                {
                    post.pqlatency = {};
                    post.pqlatency.duration = resourceList[i].duration;
                    post.pqlatency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;
                    post.pqlatency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;
                    post.pqlatency.response = resourceList[i].responseEnd - (resourceList[i].requestStart || resourceList[i].startTime);
                    post.pqlatency.size = resourceList[i].transferSize;
                }
                else if (~resourceList[i].name.indexOf('imp.revsci.net')) // TODO: SET FILTERS
                {
                    if (post.implatency == undefined)
                    {
                        post.implatency = [];
                    }

                    var implatency = {};
                    implatency.duration = resourceList[i].duration;
                    implatency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;
                    implatency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;
                    implatency.response = resourceList[i].responseEnd - (resourceList[i].responseStart || resourceList[i].startTime);
                    implatency.size = resourceList[i].transferSize;
                    post.implatency.push(implatency);
                }
            }

            var http    = new XMLHttpRequest();
            var postStr = JSON.stringify(post);
            http.open("POST", "http://localhost:3000/cnc", true); // TODO: SET METRICS SERVER URL
            http.setRequestHeader("Content-type", "application/json");
            http.send(postStr);
        },
        5000
    );
}
