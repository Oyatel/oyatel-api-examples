/*jslint browser: true, nomen: true, jquery: true */

/**
 * Oyatel API class
 * Handles authorization, streaming-api connection and REST calls with JSONP
 *
 * @version 1.0
 */

(function($) {
Oyatel = function() {
	var oauth_client_id,
		oauth_redirect_uri,
		streaming_inited = false,
		_accessToken,
		_streaming_connected = false,
		_cookieTokenDisabled = false,
		_streaming_connecting = false,
		_subscriptions = [],
		_scheduledSubscriptions = [],
		_isAuthorized = false,
		_cometdServerUri = 'https://api.oyatel.com/cometd/',
		_assumedUserId,
		oyaStreamingService;

	var _getAccessToken = function() {
		if (_cookieTokenDisabled) {
			return _accessToken;
		} else {
			return $.cookie('oyatel_access');
		}
	};
	/**
	* @param string val The access token
	* @param int expire The time in sessions till the token expires
	*/
	var _setAccessToken = function(val, expire) {
		if (_cookieTokenDisabled) {
			_accessToken = val; // only valid for this load
		} else {
			var d = new Date();
			if (isNaN(expire)) {
				// default expire time is 30 days
				expire = 2592000;
			}
			d.setTime(d.getTime() + expire * 1000);
			$.cookie('oyatel_access', val, {expires: d, path: '/'});
		}
	};

	var _getRestRequestUri = function(url) {
		var assumeString = _assumedUserId ? '&assume_user_id=' + _assumedUserId : '';
		return [url, '?suppress_response_codes=true&oauth_token=', _getAccessToken(), assumeString].join('');
	};
	var _performRestRequest = function(url, data, successcb, errorcb) {
		$.jsonp({
			url: [_getRestRequestUri(url), '&callback=?'].join(''),
			data: data,
			success: $.proxy(function(data) {
				// check for error in json return
				if (data.status_code && data.status_code == 400) {
					// we have an error, call the errorcallback
					var errorObj = {
						error_code: data.error_code,
						error_description: data.error_description
					};
					var hasHandledError = false;
					if (typeof(errorcb) == 'function')
						if (errorcb(data))
							hasHandledError = true;

					// notify global error handlers that the issue has been handled by the callback
					errorObj.hasBeenHandled = hasHandledError;
					$(Oyatel).trigger('error', errorObj, data);

				} else if (data.errorcode && data.errorcode == "auth") {
					// Got auth error, show login screen
					Oyatel.deauthorize();
				} else {
					if (typeof(successcb) == 'function')
						successcb(data);
				}
			}, this),
			error: function(xOptions, statusText) {
				console.log('Failed! Invalid access token?', xOptions, statusText);
			}
		});
	};

	var _initStreamingServer = function() {
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
					var scheduledSubscription = _scheduledSubscriptions[i];
					var subscriptionSuccessCallback = null;
					if (scheduledSubscription.length >= 3) {
						subscriptionSuccessCallback = scheduledSubscription[2];
					}
					scheduledSubscription.pop(); // pop of our own element

					var subscription = oyaStreamingService.addListener.apply(this, scheduledSubscription);
					_subscriptions.push(subscription);
					if (subscriptionSuccessCallback) {
						subscriptionSuccessCallback(subscription);
					}
				}
				_scheduledSubscriptions = [];
			}, function() {
				_streaming_connecting = false;
				// Oyatel.deauthorize();
			}, authConfig);
		}
	};
	var _disconnectStreamingServer = function() {
		if (streaming_inited) {
			_streaming_connected = false;
			_subscriptions = [];
			oyaStreamingService.disconnect();
		}
	};
	var _isFunction = function(functionToCheck) {
		var getType = {};
		return functionToCheck && getType.toString.call(functionToCheck) == '[object Function]';
	};

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
		setAssumeUserId: function(userId) {
			_assumedUserId = userId;
		},
		/**
		* Used to have more control over the mechanism to authorize
		* with OAuth access token in the API.
		*/
		disableAuthCookie: function() {
			_cookieTokenDisabled = true;
		},
		checkAuthorization: function() {
			// check "me" with the cookie
			var wasAuth = this.wasAuthorized;
			Oyatel.User.currentUser(function() {
				wasAuth(_getAccessToken());
			});
		},
		bind: function(eventName, callback) {
			return $(this).bind(eventName, callback);
		},
		getAccessToken: _getAccessToken,
		/**
		* Used to control access token only for session.
		* Can only be used when auth cookie is disabled.
		* @see Oyatel.disableAuthCookie()
		*/
		setAccessToken: function(token) {
			if (!_cookieTokenDisabled) {
				throw 'Oyatel.setAccessToken can only be used when cookie auth is disabled';
			}
			_accessToken = token;
		},
		wasAuthorized: function(access_token, expires) {
			_setAccessToken(access_token, expires);
			_isAuthorized = true;

			$(Oyatel).trigger("authorized");
		},
		authorizationFailed: function(errorcode, errormsg) {
			_isAuthorized = false;

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
			if (!w) { // popup-blocker or the alike
				window.location = url;
			}
		},
		deauthorize: function() {
			_isAuthorized = false;

			// log off Streaming API
			_disconnectStreamingServer();

			// TODO: can/should we deauthorize OAuth access from the client-side ?

			// delete cookie
			$.cookie('oyatel_access', null, {
        path: '/'
      });

			// notify
			$(this).trigger("deauthorized");
		},

		/*
		* Implementation of Oyatel API Error Codes
		*/
		ErrorCode: {
			WARNING_NUMBER_FORMAT: 200,
			ERROR_NUMBER_FORMAT: 201
		},

		/*
		* Implementation of Streaming API functionality
		* @see http://dev.oyatel.com/documentation/streaming-api/
		*/
		Events: function() {
			return {
				/**
				* @param string channel The name/path of the event-channel to subscribe to
				* @param function callback(data) The function to call when events are received
				* @param function subscribedCallback(subscriptionObj) The function to call when the subscription is confirmed.
				* @return int subscriptionId
				*/
				subscribe: function(channel, callback, subscribedCallback) {
					if (_isAuthorized) {
						// only handshake to server if we are authorized
						_initStreamingServer();
					}
					if (!_streaming_connected) {
						_scheduledSubscriptions.push([channel, callback, subscribedCallback]);
					} else {
						var subscriptionObj = oyaStreamingService.addListener(channel, callback);
						_subscriptions.push(subscriptionObj);
						if (_isFunction(subscribedCallback)) {
							subscribedCallback(subscriptionObj);
						}
					}
				},
				/**
				* @param int subscriptionId obtained from Oyatel.Events.Call
				*/
				unsubscribe: function(subscriptionObj) {
					oyaStreamingService.removeListener(subscriptionObj);
				}
			};
		}(),

		/*
		* Implementation of various REST API calls
		* @see http://dev.oyatel.com/documentation/api-oyatel-rest-api/
		*/
		User: function() {
			return {
				currentUser: function(cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/account/me.json', null, cb, errorcb);
				},
				/**
				 * Set's the user's availability.
				 *
				 * @param {string} availability 'away', 'dnd'. null or '' for setting it to availabile
				 * @param {Function} cb Callback to return object on success
				 * @param {[type]} errorcb Callback to return on errornouse response
				 */
				setAvailability: function(availability, cb, errorcb) {
					var params = {
						availability: availability
					};
					_performRestRequest('https://rest.oyatel.com/account/setAvailability.json', params, cb, errorcb);
				}
			};
		}(),
		Voicemail: function() {
			return {
				mailbox: function(cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/voicemail/mailboxForUser/', null, cb, errorcb);
				},
				getMessages: function(vboxId, cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/voicemail/getMessages/' + vboxId + '.json', null, cb, errorcb);
				},
				markMessageAsRead: function(voicemailMessageId, cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/voicemail/markMessageAsRead/' + voicemailMessageId + '.json', {}, cb, errorcb);
				},
				deleteMessage: function(voicemailMessageId, cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/voicemail/deleteMessage/' + voicemailMessageId + '.json', {}, cb, errorcb);
				},
				getMessageRecordingURL: function(messageId, format) {
					format = format || 'mp3';
					return _getRestRequestUri('https://rest.oyatel.com/voicemail/getMessageRecording/' + messageId + '.' + format + '/');
				}
			};
		}(),
		Queue: function() {
			return {

				getQueues: function(cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/queue/getQueues.json', null, cb, errorcb);
				},
				setQueueMemberships: function(queueIds, cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/queue/setQueueMemberships.json', {
						queueIds: queueIds
					}, cb, errorcb);
				}
			};
		}(),
		Did: function() {
			return {

				callflows: function(did, cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/did/callflows/' + did + '.json', null, cb, errorcb);
				},
				setActiveCallflow: function(did, params, cb, errorcb) {
					params = params || {};
					// check that params include callflowId
					_performRestRequest('https://rest.oyatel.com/did/setActiveCallflow/' + did + '.json', params, cb, errorcb);
				},
				callForward: function(did, cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/did/callForward/' + did + '.json', null, cb, errorcb);
				},
				setCallForward: function(did, params, cb, errorcb) {
					params = params || {};
					_performRestRequest('https://rest.oyatel.com/did/setCallForward/' + did + '.json', params, cb, errorcb);
				},
				removeCallForward: function(did, cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/did/removeCallForward/' + did + '.json', null, cb, errorcb);
				}

			};
		}(),
		Sms: function() {
			return {
				senderIdentities: function(cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/sms/senderIdentities.json', null, cb, errorcb);
				},
				send: function(destination_number, senderIdentity, copy_to_email, message, cb, errorcb) {
					_performRestRequest('https://rest.oyatel.com/sms/send.json', {
						destination_number : destination_number,
						senderIdentity : senderIdentity,
						copy_to_email : copy_to_email,
						message : message
					}, cb, errorcb);
				}
			};
		}(),
		Call: function() {
			return {
				callback: function(params, cb, errorcb) {
					if (!params.destination) {
						throw "destination must be set as a parameter for callback";
					}
					_performRestRequest('https://rest.oyatel.com/call/callback.json', params, cb, errorcb);
				},
				numberInfo: function(number, cb, errorcb) {
					if (!number) {
						throw "number must be set as a parameter for callback";
					}
					_performRestRequest('https://rest.oyatel.com/call/numberInfo.json', {
						number: number
					}, cb, errorcb);
				}
			};
		}()
	};
}();

})(jQuery);
