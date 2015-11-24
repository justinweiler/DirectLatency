if (Math.floor(Math.random() * 100) >= 0)  // TODO: SET SAMPLING RATE, CURRENTLY 100%
{
    setTimeout(
        function ()
        {
            var post = {source: 'Apac-1'}; // TODO: SET SOURCE ID

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

            for (var i = 0; i < resourceList.length; i++)
            {
                if (~resourceList[i].name.indexOf('pq-direct.revsci.net'))  // TODO: SET FILTERS
                {
                    var pqlatency = {source: 'pq'};
                    pqlatency.duration = resourceList[i].duration;
                    pqlatency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;
                    pqlatency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;
                    pqlatency.response = resourceList[i].responseEnd - (resourceList[i].requestStart || resourceList[i].startTime);
                    pqlatency.size = resourceList[i].transferSize;
                    post.timings.push(pqlatency);
                }
                else if (~resourceList[i].name.indexOf('imp.revsci.net')) // TODO: SET FILTERS
                {
                    var implatency = {source: 'imp'};
                    implatency.duration = resourceList[i].duration;
                    implatency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;
                    implatency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;
                    implatency.response = resourceList[i].responseEnd - (resourceList[i].responseStart || resourceList[i].startTime);
                    implatency.size = resourceList[i].transferSize;
                    post.timings.push(implatency);
                }
                else if (~resourceList[i].name.indexOf('js.revsci.net')) // TODO: SET FILTERS
                {
                    var jsplatency = {source: 'js'};
                    jsplatency.duration = resourceList[i].duration;
                    jsplatency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;
                    jsplatency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;
                    jsplatency.response = resourceList[i].responseEnd - (resourceList[i].responseStart || resourceList[i].startTime);
                    jsplatency.size = resourceList[i].transferSize;
                    post.timings.push(jsplatency);
                }
                else if (~resourceList[i].name.indexOf('pix04.revsci.net')) // TODO: SET FILTERS
                {
                    var pix04latency = {source: 'pix04'};
                    pix04latency.duration = resourceList[i].duration;
                    pix04latency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;
                    pix04latency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;
                    pix04latency.response = resourceList[i].responseEnd - (resourceList[i].responseStart || resourceList[i].startTime);
                    pix04latency.size = resourceList[i].transferSize;
                    post.timings.push(pix04latency);
                }
                // The following filter is specific to Sizmek
                else if (~resourceList[i].name.indexOf('bs.serving-sys.com')) // TODO: SET FILTERS
                {
                    var sizmek_vast_latency = {source: 'szmvs'};
                    sizmek_vast_latency.duration = resourceList[i].duration;
                    sizmek_vast_latency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;
                    sizmek_vast_latency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;
                    sizmek_vast_latency.response = resourceList[i].responseEnd - (resourceList[i].responseStart || resourceList[i].startTime);
                    sizmek_vast_latency.size = resourceList[i].transferSize;
                    post.timings.push(sizmek_vast_latency);
                }
                // The following filter is specific to Sizmek
                else if (~resourceList[i].name.indexOf('secure-ds.serving-sys.com')) // TODO: SET FILTERS
                {
                    var sizmek_video_latency = {source: 'szmvd'};
                    sizmek_video_latency.duration = resourceList[i].duration;
                    sizmek_video_latency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;
                    sizmek_video_latency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;
                    sizmek_video_latency.response = resourceList[i].responseEnd - (resourceList[i].responseStart || resourceList[i].startTime);
                    sizmek_video_latency.size = resourceList[i].transferSize;
                    post.timings.push(sizmek_video_latency);
                }
                // The following filter is specific to Sizmek serving in Vietnam
                else if (~resourceList[i].name.indexOf('ds-vn.serving-sys.com')) // TODO: SET FILTERS
                {
                    var sizmek_vn_video_latency = {source: 'szmnvd'};
                    sizmek_vn_video_latency.duration = resourceList[i].duration;
                    sizmek_vn_video_latency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;
                    sizmek_vn_video_latency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;
                    sizmek_vn_video_latency.response = resourceList[i].responseEnd - (resourceList[i].responseStart || resourceList[i].startTime);
                    sizmek_vn_video_latency.size = resourceList[i].transferSize;
                    post.timings.push(sizmek_vn_video_latency);
                }
            }

            var http    = new XMLHttpRequest();
            var postStr = JSON.stringify(post);
            http.open("POST", "http://52.26.78.96/cnc", true); // TODO: SET METRICS SERVER URL
            http.setRequestHeader("Content-type", "application/json");
            http.send(postStr);
        },
        5000
    );
}
