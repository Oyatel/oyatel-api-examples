/*
 * These classes are examples for using Oyatels streaming events API through CometD.
 * */
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

using Cometd.Client;
using Cometd.Client.Transport;
using Cometd.Bayeux;
using Cometd.Bayeux.Client;
using Cometd.Common;


namespace Oyatel.Connect.Tutorial
{
    // Delegate for callevents:
    public delegate void CallEvent(IDictionary<String, Object> data);
    // Delegate for events taking bool parameter:
    public delegate void BoolEvent(bool success);
        
    /*
     * Subscribe and listen to connected/disconnected-events.
     * */
    public class ConnectionListener : IMessageListener
    {
        public bool connected = false;

        public ConnectionListener()
            : base()
        {
        }

        public void onMessage(IClientSessionChannel channel, IMessage message)
        {
            if (message.Successful)
            {
                if (!connected)
                {
                    connected = true;
                }
            }
            else
            {
                if (connected)
                {
                    connected = false;
                }
            }
        }
    }

    /*
     * Subscribe and listen to logincompleted-events.
     * */
    public class InitializerListener : IMessageListener
    {
        private event BoolEvent onLoginCompleted;
        public String userId = "";
        public String username = "";

        public InitializerListener(BoolEvent onLoginCompleted)
            : base()
        {
            this.onLoginCompleted += onLoginCompleted;
        }

        public void onMessage(IClientSessionChannel channel, IMessage message)
        {
            try
            {
                IDictionary<String, Object> ext = (IDictionary<String, Object>)message.Ext["authentication"];
                userId = ext["userId"].ToString();
                username = ext["username"].ToString();
            }
            catch (Exception)
            {
            }

            onLoginCompleted(message.Successful);
        }
    }

    /*
     * Subscribe and listen to callevents.
     * */
    public class BatchCallEventListener : IMessageListener
    {
        public BayeuxClient client;
        private event CallEvent onCallEvent;

        public BatchCallEventListener(BayeuxClient client, CallEvent onCallEvent)
        {
            this.client = client;
            this.onCallEvent = onCallEvent;
        }

        public void Run()
        {
            IClientSessionChannel callEventChannel = client.getChannel("/events/call");

            callEventChannel.unsubscribe(this);
            callEventChannel.subscribe(this);
        }

        public void onMessage(IClientSessionChannel channel, IMessage message)
        {
            try
            {
                IDictionary<String, Object> data = message.DataAsDictionary;
                // Trigger callback:
                onCallEvent(data);
            }
            catch (Exception)
            {
            }
        }
    }

    /*
     * Main class for setting up streaming events.
     * */
    public class StreamingEvents
    {
        protected BayeuxClient client;
        protected InitializerListener initListener;
        protected ConnectionListener connectionListener = null;
        protected String url = "https://api.oyatel.com:443/cometd/cometd";
        private CallEvent onCallEvent;

        /*
         * Set up, log-in and listen to streaming events from Oyatel.
         * This example listens for call-events.
         * */
        public StreamingEvents(CallEvent onCallEvent)
        {
            this.onCallEvent = onCallEvent;
        }

        public void Connect(String access_token)
        {
            IList<ClientTransport> transports = new List<ClientTransport>();

            transports.Add(new LongPollingTransport(null));
            client = new BayeuxClient(url, transports);

            // Subscribe and call 'Initialize' after successful login
            initListener = new InitializerListener(Initialize);
            client.getChannel(Channel_Fields.META_HANDSHAKE).addListener(initListener);

            // Subscribe to connect/disconnect-events
            connectionListener = new ConnectionListener();
            client.getChannel(Channel_Fields.META_CONNECT).addListener(connectionListener);

            // Handshaking with oauth2
            IDictionary<String, Object> handshakeAuth = new Dictionary<String, Object>();

            handshakeAuth.Add("authType", "oauth2");
            handshakeAuth.Add("oauth_token", access_token);

            IDictionary<String, Object> ext = new Dictionary<String, Object>();

            ext.Add("ext", handshakeAuth);
            client.handshake(ext);
            client.handshake(handshakeAuth);
        }

        public void Disconnect()
        {
            client.disconnect();
        }

        public bool Connected
        {
            get
            {
                if (connectionListener == null) return false;

                return connectionListener.connected;
            }
        }

        private void Initialize(bool success)
        {
            if (success)
            {
                BatchCallEventListener batch = new BatchCallEventListener(client, onCallEvent);
                client.batch(new BatchDelegate(batch.Run));
            }
        }
    }
}
