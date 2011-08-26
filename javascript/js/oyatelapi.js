// Namespaces for the cometd implementation

(function($)
{

this.com = this.com || {};
this.com.oyatel = this.com.oyatel || {};

com.oyatel.ReadCookie = function(name) {
  name += '=';
  var parts = document.cookie.split(/;\s*/);
  for (var i = 0; i < parts.length; i++)
  {
    var part = parts[i];
    if (part.indexOf(name) == 0)
      return part.substring(name.length)
  }
  return null;
};

com.oyatel.Service = function(params) {
	var _crossDomain = true;
	var _status = 'disconnected';
	var _cometdConnected = false;
	var _cometdSubscriptions = [];
	var _connected;
	var _consumerKey = '48b9476b3958496f1df7722284c575f204c8e1432';
	var _presenceSubscription = null;
	var _queueSubscription = null;
	var _hasBeenConnectedBefore = false;
	var _disconnectListener = null;

	params = params || {};
	
	var _url = (params.url ? params.url : 'https://apibeta.oyatel.com/cometd/');
	_oauthUrl = _url + 'oauth/';
	_url += 'cometd/';
		
	/**
	 * Listener that is registered on connect() to notify
	 * successfull connection to Oyatel API
	 */
	var _connectListener;
	
    function _connectionSucceeded() {    	
    	// connection to cometd was successfull (not neccessary login to oyatel service)
        // console.log('Connection succeeded, unsubscribing old subscriptions');
        
    	 if (_hasBeenConnectedBefore) {
			// console.log('We have been connected before, this is a reconnect, re-subscribe');
			// this is a re-connect, re-add subscriptions
			_reconnectPrevSubscriptions();
		} else if (!_hasBeenConnectedBefore) {
			// console.log('First time connecting, set that we have been connected');
			_hasBeenConnectedBefore = true;
		}
    		
        /*$.cometd.batch(function() {
        	// unsubscribe subscriptions...
        	for (var i = 0; i < _cometdSubscriptions.length; i++) {
                $.cometd.unsubscribe(_cometdSubscriptions[i]);
            }
        });
        */
        
        _cometdConnected = true;

/*
        if (_connectListener) {
        	_connectListener();
        }
*/
    }

    function _connectionBroken() {
        // cometd connection broken...
    	// console.info('oyatelapi: Connection was broken..');
    	_cometdConnected = false;

		// invalidate all subscriptions
		
	try {
	    	if (_disconnectListener) {
    			_disconnectListener();
	    	}
	} catch (e) {}
    }

    
    // Function that manages the connection status with the Bayeux server
    function _metaConnect(message) {
    	// console.log('_metaConnect');
		if ($.cometd.isDisconnected()) {
			// console.log('_metaConnect.cometd.isDisconnected()');
			_connected = false;
			_connectionClosed();
			return;
		}
    	
        var wasConnected = _connected;        
        _connected = message.successful === true;
        
        if (!wasConnected && _connected) {
        	// console.log('_metaConnect.connectionSucceeded()');
        	_connectionSucceeded();
        } else if (wasConnected && !_connected) {
        	// console.log('_metaConnect.connectionBroken()');
            _connectionBroken();
        }
    }
    
    //
    // PUBLIC API
    //

    this.configure = function(cfg) {
    	_configure.call(this, configuration);
    };
    
	/**
     * Disconnects from the Oyatel API server.
     * @param disconnectProps an object to be merged with the disconnect message
     * @todo Public method needing documentation
     */
    this.disconnect = disconnectHandler = function(disconnectProps) {
		// console.info('APIService::disconnect()');
		
    	_connected = false;

    	$.cometd.clearListeners();
		_cometdSubscriptions = [];
    	// $.cometd.clearSubscriptions();
	
    	try {
    		$.cometd.disconnect();
        	if (_disconnectListener)
	               _disconnectListener();
    	} catch (e) {}
	_connectListener = null;
        _disconnectListener = null;
    };
    
    function unloadHandler() {
		_connected = false;
		disconnectHandler();
	};

	/*if (window.onbeforeunload) {
		window.onbeforeunload(unloadHandler);
	} else {
		
	}
	*/
	$(window).unload(unloadHandler);

    /**
     * @todo Public method needing documentation
     * @todo not finalized in API
     */
    this.connect = function(authorizedCallback, disconnectCallback, authConfig) {
    	_connectListener = authorizedCallback;
    	_disconnectListener = disconnectCallback;
    	
    	var cometURL = _url;
    	
		$.cometd.unregisterTransport('websocket');
	    $.cometd.configure({
	        url: cometURL,
	        crossDomain: true,
	        // logLevel: 'debug'
	        logLevel: 'info'
	    });
	    
		_metaConnectSubscription = $.cometd.addListener('/meta/connect', _metaConnect);
		$.cometd.addListener('/meta/handshake', function(message) {
			var auth = message.ext && message.ext.authentication;
    		if (auth && auth.failed === true)
    		{
    			// Authentication failed, trigger 
    			// Oyatel Authorization window
    			// console.info('Authorization failed, authorizing user!');
    			_authorizeUser();
			// @todo According to sbordet, message.success is what should be checked instead
    		} else if (message.failure) {
				// something wrong happened, ignore!
				
			} else {
				_connectListener();
			}
		});
		
		var handshakeParams = {
    		ext: {
    			authType: authConfig.authType ? authConfig.authType : 'oauth2',
    			sessionId: authConfig.sessionId ? authConfig.sessionId : '',
    			oauth_token: authConfig.oauth_token ? authConfig.oauth_token : '',
    			referrer: document.location.href
    		}
    	};
		
    	$.cometd.handshake(handshakeParams);
    };
 
    
    /**
     * @return boolean
     */
    this.isConnected = function() {
    	return _connected;
    };
    
	function _authorizeUser() {
		return; // disabled for now...
		// console.debug('authorizing user request');
		// request token
		$.ajax({
			url: _oauthUrl + 'requestToken',
			consumerKey: _consumerKey,
			success: function(message) {
				oauth_token = message.oauth_token;
				oauth_secret = message.oauth_secret;
				callback_confirmed = message.callback_confirmed;
				
				var popupParams = 'location=0,status=0,width=800,height=400';
				// this._oyatelAuthenticateWindow = window.open('https://cm.oyatel.com/authorize/?token=')
				this._oyatelAuthenticateWindow = window.open(_oauthUrl + 'authorize?oauth_token=' + oauth_token, 'Authorization', popupParams);
				this._authenticateInterval = window.setInterval(_completeOyatelAuthorization, 1000);
			}
		});
	}
	
	function _completeOyatelAuthorization() {
		if (this._oyatelAuthenticateWindow.closed) {
			window.clearInterval(this._authenticateInterval);
			// console.log('Should run window.location.reload();');
			// window.location.reload();
		}
	}
    
    /**
     * @todo Public method needing documentation
     * 
     * @param {String} channel The name of the channel to listen for events on
     * @param {} callback
     * @param [scope] Optional scope
     * @param [filters] Optional filters
     * @return
     * @type Subscription
     */
    this.addListener = function(channel, callback, filters, scope) {
    	// console.log('Adding listener for channel: ' + channel);
    	
    	scope = scope || undefined;
    	filters = filters || {};
    	$.extend(filters, {
    		
    	});
    	
    	var params = {
    		ext: {
    			filters: filters
    		}
    	};
    	
    	/* if (this.isConnected()) {
    		// console.log('is connected, adding subscription');
    	} else {
    		// console.log('We are not connected, will need to connect later...');
    	}*/

    	var subscription = $.cometd.subscribe(channel, scope, callback, params);
		_cometdSubscriptions.push({
			id: subscription,
			channel: channel,
			scope: scope,
			callback: callback,
			active: true,
			params: params
		});
		
    	return subscription;
    };
    
    function _reconnectPrevSubscriptions() {
    	for (var i = 0; i < _cometdSubscriptions.length; i++) {
    		if (_cometdSubscriptions[i]['id']) {
    			// console.log('Unsubscription to channel before reconnect: ' + _cometdSubscriptions[i]['channel']);
    			$.cometd.unsubscribe(_cometdSubscriptions[i]['id']);
    		}
    		// console.log('Reconnecting subscription with channel: ' + _cometdSubscriptions[i]['channel']);
			// if (!_cometdSubscriptions[i]['active']) {
	    		_cometdSubscriptions[i]['id'] = $.cometd.subscribe(
	    			_cometdSubscriptions[i]['channel'], 
					_cometdSubscriptions[i]['scope'], 
					_cometdSubscriptions[i]['callback'], 
					_cometdSubscriptions[i]['params']
				);
			// }
			_cometdSubscriptions[i]['active'] = true;
    	}
    }
    	
    /**
     * @param {Subscription} The subscription from #addListener
     * @see #addListener(channel, callback, scope, filters)
     */
    this.removeListener = function(subscription) {
    	for (var i = 0; i < _cometdSubscriptions.length; i++) {
    		if (_cometdSubscriptions[i]['id'] == subscription) {
			
    			// console.log('Unsubscription subscription for channel: ' + _cometdSubscriptions[i]['channel']);
    			_cometdSubscriptions = _cometdSubscriptions.splice(i, 1);
    			// delete _cometdSubscriptions[i];
    		}
    			// delete _cometdSubscriptions[i];
    	}
    	$.cometd.unsubscribe(subscription);
    };
    

    this.sayHello = function(name) {
    	$.cometd.subscribe('/hello', function(msg) {
    		console.log('Got hello: ' + msg.data);
    	});
    	$.cometd.publish('/service/hello', {name: name});
    };
    
	this.triggerCallback = function(dst) {
		$.cometd.publish('/service/call/callback', {
			destinationNumber: dst
		});
	};
}

$.oyatelapi = new com.oyatel.Service();

com.oyatel.Service.SMS = function() {
	
}

})(jQuery);
