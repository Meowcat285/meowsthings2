function getRespArrTabs(lHostName, b64Url, b64Msg, info_url, tabId)
{
	//var curTabId = null;
	var respCode = _getResCode(lHostName);
	var toSendUrl = "";

	// if user is notloggedin, deny everything except securly.com and google.com pages
	if (userEmail == "notloggedin") {
		respCode = "DENY:0:-1:-1:-1:-1:-1";
		return respCode.split(":");
	}
	// check that brokering requred for classroom.
	if(doBrokerForClassroom()){
		respCode="";
	}
	if ( !respCode )
	{
		selfClusterCheckBeforeBroker();
		toSendUrl = window.clusterUrl + "/broker?useremail=" + window.userEmail + "&reason=crextn" + "&host=" +
					lHostName + "&url=" + b64Url + "&msg=" + b64Msg + "&ver=" + window.version + "&cu=" +
					window.clusterUrl + "&uf=" + window.userFound + "&cf=" + window.clusterFound;

		var request = createNonBlockingRequest("get", toSendUrl);

		request.onerror = function() { respCode="ERROR:-1:-1:-1:-1:-1:-1"; }; // Network error
		request.onload = function()
		{
			respCode=request.responseText.trim();
			setClassroomCookies();

			// save ALLOW, SS and YT res in session storage, for DENY, we want to log it in splunk every time
			// session storage will be flushed every 5 min, see setupOrReload() in util.js
			// ALLOW, SS and YT res will be logged in splunk at least every 5 min
			if ( (respCode.indexOf("DENY")==-1) )
			{
				//if ( (skipCacheAndLogAlways(lHostName, info_url)==0) )
				{
					try
					{
						sessionStorage.setItem(lHostName, respCode + "," + new Date().getTime() / 1000);
						var timeStamp = Math.floor(Date.now() / 1000);
						setCookie('last_broker_call',timeStamp,5);
					}
					catch (error)
					{
						// Once you hit capacity clear all Securly.com origin storage and start over
						sessionStorage.clear(); // TODO: In incognito mode, this may still not allow setitem to work - but we will function as if sessionStorage is missing
					}
				}
			}
			else // respCode from cloud was DENY
			{
				var respArr = respCode.split(":");
				var actionStr = respArr[0];
				var policyStr = respArr[1];
				var categoryStr = respArr[2];
				var keywordScanStr = respArr[3];
				var ytSSStr = respArr[4];
				var ytEduStr = respArr[5];
				var ytEduAccStr = respArr[6];

				takeDenyActionTabs(policyStr, categoryStr, keywordScanStr, b64Url, tabId);
			}
		};

		try
		{
			request.send();
		}
		catch(error)
		{
			respCode="ERROR:-1:-1:-1:-1:-1:-1";
		}

		// If resp-code not found in cache, Page is allowed or safe-search.
		// For Allow, if the result comes back as DENY, we block later.
		// For Google, Bing, Yahoo, we always have 1st result as safe.
		// The exclusions may not be needed because interceptOrNot() will skip them. Added here for parnoia (Vinay is working remotely and doesn't want to take a risk)
		if (
		(
			info_url.indexOf("google.c") != -1 &&
			info_url.indexOf("sites.google.com") == -1 &&
			info_url.indexOf("docs.google.com") == -1 &&
			info_url.indexOf("drive.google.com") == -1 &&
			info_url.indexOf("accounts.google.com") == -1 &&
			info_url.indexOf("calendar.google.com") == -1 &&
			info_url.indexOf("code.google.com") == -1
		) || (info_url.indexOf("bing.com") != -1) || (info_url.indexOf("search.yahoo.c") != -1) )
		{
			respCode="SS:0:-1:-1:-1:-1:-1";
		}
		else
		{
			respCode="ALLOW:0:-1:-1:-1:-1:-1";
		}
	}
	else // respCode found in cache
	{
		if ( (respCode.indexOf("ALLOW")!=-1) && (skipCacheAndLogAlways(lHostName, info_url)==0) )
		{
		}
		else // Not allow (SS, GM, YT) Or (Allow but skipcacheandlogalways=1)
		{
			selfClusterCheckBeforeBroker();
			toSendUrl = window.clusterUrl + "/broker?useremail=" + window.userEmail + "&reason=crextn" + "&host=" +
						lHostName + "&url=" + b64Url + "&msg=" + b64Msg + "&ver=" + window.version + "&cu=" +
						window.clusterUrl + "&uf=" + window.userFound + "&cf=" + window.clusterFound;

			var request = createNonBlockingRequest("get", toSendUrl);

			// update SS / GM / YT results in session storage
			// update the session storage based on the new broker reply
			request.onerror = function() {
				respCode = "ERROR:-1:-1:-1:-1:-1:-1";
			};

			request.onload = function() {
				respCode = request.responseText.trim();
				var respArr = respCode.split(":");
				var actionStr = respArr[0];
				var policyStr = respArr[1];
				var categoryStr = respArr[2];
				var keywordScanStr = respArr[3];

				if (actionStr != "DENY") {

					try {
                        sessionStorage.setItem(lHostName, respCode + "," + new Date().getTime() / 1000);
					}
					catch (error) {
						// Once you hit capacity clear all Securly.com origin storage and start over
						sessionStorage.clear();
						// TODO: In incognito mode, this may still not allow setitem to work
						// but we will function as if sessionStorage is missing
					}

				} else if (actionStr == "DENY") {
					// if broker returns deny like kids searching db 25 dirty words
					takeDenyActionTabs(policyStr, categoryStr, keywordScanStr, b64Url, tabId);
				}
			};

			try
			{
				request.send();
			}
			catch(error)
			{
			}

			// cache cleared periodically, and also broker throttles every 5 mins
			// session storage clear is at setupOrReload() in util.js
		}
	}

	// Respcode found in cache OR set to Allow until we hear back from broker
	var respArr = respCode.split(":");
	if (respArr.length !== 7) // Assume onload had some error due to say php timeout etc
	{
		respCode="ERROR:-1:-1:-1:-1:-1:-1"; sessionStorage.removeItem(lHostName);
		respArr = respCode.split(":");
	}

	return respArr;
}

function getRespArr(lHostName, b64Url, b64Msg, info_url)
{
    var respCode = _getResCode(lHostName);
	var toSendUrl = "";
	// check that brokering requred for classroom.
	if(doBrokerForClassroom()){
		respCode="";
	}

	if ( !respCode )
	{
		selfClusterCheckBeforeBroker();
		toSendUrl = window.clusterUrl + "/broker?useremail=" + window.userEmail + "&reason=crextn" + "&host=" +
					lHostName + "&url=" + b64Url + "&msg=" + b64Msg + "&ver=" + window.version + "&cu=" +
					window.clusterUrl + "&uf=" + window.userFound + "&cf=" + window.clusterFound;

		var request = createBlockingRequest("get", toSendUrl);

		request.onerror = function() { respCode="ERROR:-1:-1:-1:-1:-1:-1"; }; // Network error
		request.onload = function()
		{
			
			setClassroomCookies();
			respCode=request.responseText.trim();
			if ( (respCode.indexOf("DENY")==-1) && (skipCacheAndLogAlways(lHostName, info_url)==0) )
			{
				try
				{
					sessionStorage.setItem(lHostName, respCode);
					var timeStamp = Math.floor(Date.now() / 1000);
					setCookie('last_broker_call',timeStamp,5);
				}
				catch (error)
				{
					// Once you hit capacity clear all Securly.com origin storage and start over
					sessionStorage.clear(); // TODO: In incognito mode, this may still not allow setitem to work - but we will function as if sessionStorage is missing
				}
			}
		};

		try
		{
			request.send();
		}
		catch(error)
		{
			respCode="ERROR:-1:-1:-1:-1:-1:-1";
		}
	}

	var respArr = respCode.split(":");
	if (respArr.length !== 7) // Assume onload had some error due to say php timeout etc
	{
		respCode="ERROR:-1:-1:-1:-1:-1:-1";
		respArr = respCode.split(":");
		sessionStorage.removeItem(lHostName);
	}

	return respArr;
}

function _getResCode(lHostName){
    var respCode = null;
    var results = sessionStorage.getItem(lHostName);
    if(results){
        results = results.split(",");
        if(results.length == 2){
            var timeDiff = (new Date().getTime() / 1000) - results[1];
            if (timeDiff < 30 * 60)
                respCode = results[0];
        }else{
            respCode = sessionStorage.getItem(lHostName);
        }
    }
	return respCode;
}