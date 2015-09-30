setTimeout(
    function()
    {
        var e = document.createElement("script");
        var s = document.getElementsByTagName("BODY")[0];
        e.innerHTML = "\
        console.log(JSON.stringify(newCookie));\
        chrome.cookies.set(newCookie);\
        console.log(JSON.stringify(asiPlacements));\
        var post = {source: 'Canary-C'};\
        if (typeof asiPlacements != 'undefined')\
        {\
            for (asiPlacement in asiPlacements)\
            {\
                asiBlob = asiPlacements[asiPlacement].blob;\
                if (typeof asiBlob != 'undefined')\
                {\
                    post.bid  = true;\
                    post.blob = asiBlob;\
                }\
                break;\
            }\
            if (post.bid == undefined)\
            {\
                post.nobid = true;\
            }\
        }\
        if (post.bid == undefined && post.nobid == undefined)\
        {\
            post.fail = true;\
        }\
        var resourceList = window.performance.getEntries();\
        for (var i = 0; i < resourceList.length; i++)\
        {\
            if (~resourceList[i].name.indexOf('pq-direct.revsci.net'))\
            {\
                post.pqlatency  = {};\
                post.pqlatency.duration = resourceList[i].duration;\
                post.pqlatency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;\
                post.pqlatency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;\
                post.pqlatency.response = resourceList[i].responseEnd - (resourceList[i].requestStart || resourceList[i].startTime);\
                post.pqlatency.size = resourceList[i].transferSize;\
            }\
            else if (~resourceList[i].name.indexOf('imp.revsci.net'))\
            {\
                if (post.implatency == undefined)\
                {\
                    post.implatency = [];\
                }\
                var implatency = {};\
                implatency.duration = resourceList[i].duration;\
                implatency.dns = resourceList[i].domainLookupEnd - resourceList[i].domainLookupStart;\
                implatency.connection = resourceList[i].connectEnd - resourceList[i].connectStart;\
                implatency.response = resourceList[i].responseEnd - (resourceList[i].responseStart || resourceList[i].startTime);\
                implatency.size = resourceList[i].transferSize;\
                post.implatency.push(implatency);\
            }\
        }\
        var http = new XMLHttpRequest();\
        var postStr = JSON.stringify(post);\
        http.open('POST', 'http://52.26.78.96/cnc', true);\
        http.setRequestHeader('Content-Type', 'application/json');\
        http.send(postStr);";

        s.parentNode.insertBefore(e, s);
    },
    5000
);