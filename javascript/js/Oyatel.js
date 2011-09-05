/**
 * Oyatel API class
 * Handles authorization, streaming-api connection and REST calls with JSONP
 *
 * @version 1.0
 */

(function($) {
Oyatel = function() {
	var oauth_client_id;
	var oauth_redirect_uri;
	var streaming_inited = false;
	var _streaming_connected = false;
	var _streaming_connecting = false;
	var _subscriptions = [];
	var _scheduledSubscriptions = [];
	
	var _cometdServerUri = 'https://api.oyatel.com/cometd/';
	var oyaStreamingService;
		
	_getAccessToken = function() {
		return $.cookie('oyatel_access');
	};
	_setAccessToken = function(val, expire) {
		$.cookie('oyatel_access', val, {expires: expire});
	};
	
	_getRestRequestUri = function(url) {
		return [url, '?oauth_token=', _getAccessToken()].join('');
	}
	_performRestRequest = function(url, data, cb) {	
		// console.log('Performing request to: ' + [_getRestRequestUri(url), '&callback=?'].join(''));

		$.jsonp({
			url: [_getRestRequestUri(url), '&callback=?'].join(''),
			data: data,
			success: function(data) {
				// check for error in json return
				if (data.errorcode && data.errorcode == "auth") {
					// console.log("Got auth error, show login screen");
					Oyatel.deauthorize();
				} else {
					// console.log("Data is: " , data);
					cb(data);
				}
			},
			error: function(xOptions, statusText) {
				// console.log('Request failed for some reason...', );
				console.log('Failed! Invalid access token, ', xOptions, statusText);
			}
		});
	}
	
	_initStreamingServer = function() {
		if (!streaming_inited) {
			oyaStreamingService = new com.oyatel.Service({
				url: _cometdServerUri
			});
			streaming_inited = true;
		}
		if (!_streaming_connected && !_streaming_connecting) {
			var authConfig = {
				oauth_token: _getAccessToken()
			};
			_streaming_connecting = true;
			oyaStreamingService.connect(function() {
				_streaming_connected = true;
				_streaming_connecting = false;

				for (var i = 0; i < _scheduledSubscriptions.length; i++) {
					var subscription = oyaStreamingService.addListener.apply(this, _scheduledSubscriptions[i]);
					_subscriptions.push(subscription);
				}
				_scheduledSubscriptions = [];
			}, function() {
				_streaming_connecting = false;
				// Oyatel.deauthorize();
			}, authConfig);
		}
	};
	_disconnectStreamingServer = function() {
		if (streaming_inited) {
			_streaming_connected = false;
			_subscriptions = [];
			oyaStreamingService.disconnect();
		}
	}
	
	return {
		/** Only for testing, not PUBLIC API **/
		_getStreamingServerObj: function() {
			return oyaStreamingService;
		},
				
		init: function(client_id, redirect_uri, cometdServerUri) {
			oauth_client_id = client_id;
			oauth_redirect_uri = redirect_uri;
			if (cometdServerUri) {
				_cometdServerUri = cometdServerUri;
			}
		},
		checkAuthorization: function() {
			// check "me" with the cookie
			wasAuth = this.wasAuthorized;
			Oyatel.User.currentUser(function() {
				wasAuth(_getAccessToken());
			});
		},
		bind: function(eventName, callback) {
			$(this).bind(eventName, callback);
		},
		getAccessToken: _getAccessToken,
		wasAuthorized: function(access_token, expires) {
			_setAccessToken(access_token, expires);
			
			$(Oyatel).trigger("authorized");
		},
		authorizationFailed: function(errorcode, errormsg) {
			$(this).trigger("authorizationfailed", {
				code: errorcode,
				msg: errormsg
			});
		},
		authorize: function() {
			// authenticate with the Oyatel Streaming API

			// check if the browser is Safari Mobile
			
			var url = 'https://oauth.oyatel.com/oauth/authorize?client_id=' + oauth_client_id + '&response_type=token&redirect_uri=' + oauth_redirect_uri;
			var w = window.open(url,'auth_popup','width=840,height=550,scrollbars=0');
			if (!w) {
				window.location = url;
			}
		},
		deauthorize: function() {
			// log off Streaming API
			_disconnectStreamingServer();
			
			// TODO: can/should we deauthorize OAuth access from the client-side ?
			
			// delete cookie
			$.cookie('oyatel_access', null);
			
			// notify
			$(this).trigger("deauthorized");
		},
		
		Events: function() {
			return {
				subscribe: function(channel, callback) {
					// console.log('Adding subscribe for: ' + channel);
					_initStreamingServer();
					if (!_streaming_connected) {
						_scheduledSubscriptions.push([channel, callback]);
					} else {
						var subscription = oyaStreamingService.addListener(channel, callback);
						_subscriptions.push(subscription);
					}
				}
			}
		}(),
		User: function() {
			return {
				currentUser: function(cb) {
					// console.log('cheking current user');
					_performRestRequest('https://rest.oyatel.com/account/me.json', null, cb);
				}
			}
		}(),
		Voicemail: function() {
			return {
				mailbox: function(cb) {
					_performRestRequest('https://rest.oyatel.com/voicemail/mailboxForUser/', null, cb);
				},
				getMessages: function(vboxId, cb) {
					_performRestRequest('https://rest.oyatel.com/voicemail/getMessages/' + vboxId + '.json', null, cb);	
				},
				getMessageRecordingURL: function(messageId, format) {
					var format = format || 'wav';
					return _getRestRequestUri('https://rest.oyatel.com/voicemail/getMessageRecording/' + messageId + '.' + format + '/');
				}
			}
		}(),
		Queue: function() {
			return {
				
				getQueues: function(cb) {
					_performRestRequest('https://rest.oyatel.com/queue/getQueues.json', null, cb);
				}
			}
		}(),
		Call: function() {
			return {
				callback: function(params, cb) {
                                        if (!params.destination) {
                                                throw "destination must be set as a parameter for callback";
                                        }
					_performRestRequest('https://rest.oyatel.com/call/callback.json', params, cb);
				},
				numberInfo: function(number, cb) {
                                        if (!number) {
                                                throw "number must be set as a parameter for callback";
                                        }
					_performRestRequest('https://magnusdev.oyatel.com/rest/call/numberInfo.json', {
						number: number
					}, cb);
				}
			}
		}()
	};
}();

})(jQuery);
