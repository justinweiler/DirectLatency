if (Math.floor(Math.random() * 100) >= 0)  // TODO: SET SAMPLING RATE, CURRENTLY 100%
{
    setTimeout(
        function ()
        {
            var post = {region: 'Apac-1', source: new URL(document.URL).hostname}; // TODO: SET REGION ID

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

            post.timings = [];

            var resourceList = window.performance.getEntries();
            var registeredPQ = false;

            // TODO: Edit filters
            var domains = [
                {filter: 'pq-direct.revsci.net',        source: 'pq'},      // ASCI pre-qual (do not delete this)
                {filter: 'imp.revsci.net',              source: 'imp'},     // ASCI imp server
                {filter: 'js.revsci.net',               source: 'js'},      // ASCI js gateway
                {filter: 'pix04.revsci.net',            source: 'pix04'},   // ASCI BGAS
                {filter: 'cdn1.revsci.net',             source: 'cdn1'},    // ASCI legacy cdn
                {filter: '.revsci.net',                 source: 'revsci'},  // ASCI unknown
                {filter: 'bs.serving-sys.com',          source: 'szmvs'},   // Sizmek vast
                {filter: 'secure-ds.serving-sys.com',   source: 'svmvd'},   // Sizmek video
                {filter: 'ds-vn.serving-sys.com',       source: 'szmnvd'}   // Sizmek video serving in Vietnam
            ];

            for (var i = 0; i < resourceList.length; i++)
            {
                var resource = resourceList[i];
                var resourceHost = new URL(resource.name).hostname;

                for (var d = 0; d < domains.length; d++)
                {
                    if (resourceHost && ~resourceHost.indexOf(domains[d].filter))
                    {
                        var timing        = {source: domains[d].source};
                        timing.duration   = resource.duration;
                        timing.dns        = resource.domainLookupEnd - resource.domainLookupStart;
                        timing.connection = resource.connectEnd - resource.connectStart;
                        timing.request    = resource.responseStart - resource.requestStart;
                        timing.response   = resource.responseEnd - resource.responseStart;
                        timing.size       = resource.transferSize;

                        if (timing.source == 'revsci')
                        {
                            console.log('Found unknown:', resourceHost);
                        }

                        if (timing.duration)
                        {
                            if (timing.source == 'pq')
                            {
                                registeredPQ = true;
                            }

                            post.timings.push(timing);
                        }

                        break;
                    }
                }
            }

            if (registeredPQ && post.timings.length)
            {
                var http    = new XMLHttpRequest();
                var postStr = JSON.stringify(post);
                //http.open("POST", "http://52.26.78.96/cnc", true);
                http.open("POST", "http://127.0.0.1:3000/cnc", true); // TODO: SET METRICS SERVER URL
                http.setRequestHeader("Content-type", "application/json");
                http.send(postStr);
            }
        },
        6000
    );
}
