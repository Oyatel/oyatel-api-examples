/*
 * Demo for using REST- and Streaming events API with Oyatel Connect.
 * 
 * Remember to include reference to cometd2.dll for CometD-support,
 * and to System.ServiceModel, System.ServiceModel.Web and System.Web.Extensions for Json-support.
 * This example uses .NET 4.0 (does *not* work with Client Profile)
 * */
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Net;
using System.IO;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Threading;
using System.ServiceModel.Web;
using System.Web.Script.Serialization;
using System.Windows.Forms;


namespace Oyatel.Connect.Tutorial
{
    public partial class DemoForm : Form
    {
        private Authorize authorize;
        private StreamingEvents streamingEvents;
        private static JavaScriptSerializer jsonParser = new JavaScriptSerializer();

        public DemoForm()
        {
            InitializeComponent();
            
            authorize = new Authorize(
                // Replace with your client_id:
                "9fbbd44f-16e8-4a7f-aea9-792ac51a9ffa",
                "https://oauth.oyatel.com/oauth/success.html",
                new Authorize.AuthorizationResponse(this.AuthorizationCallback));

            streamingEvents = new StreamingEvents(new CallEvent(this.CallEventCallback));
        }

        /*
         * Triggered when "Connect to Oyatel"-button clicked:
         * */
        private void button1_Click(object sender, EventArgs e)
        {
            topBox.Text = "";
            eventBox.Text = "";
            
            if (streamingEvents.Connected) streamingEvents.Disconnect();

            // Oyatel Connect webbrowser popup:
            authorize.loginPopup();
        }

        /*
         * Called when user cancels or successfully logs in.
         * */
        private void AuthorizationCallback(bool authorized, String error)
        {
            if (authorized)
            {
                topBox.Text += "access_token = " + authorize.access_token + "\n";

                // Get userinfo in json-format from Oyatel REST-API:
                String target_uri = "https://rest.oyatel.com/account/me.json?&oauth_token=" + authorize.access_token;

                WebClient client = new WebClient();
                StreamReader reader = new StreamReader(client.OpenRead(target_uri));
                String jsonString = reader.ReadToEnd();

                Dictionary<String, String> userInfo = jsonParser.Deserialize<Dictionary<String, String>>(jsonString);
                foreach (KeyValuePair<String, String> kvp in userInfo)
                {
                    topBox.Text += "  " + kvp.Key + ": " + kvp.Value + "\n";
                }

                // Connect to Streaming API and listen to callevents:
                streamingEvents.Connect(authorize.access_token);
            }
            else
            {
                topBox.Text += "Authorization failed: " + error + "\n";
            }
        }

        /*
         * Callback triggered every time a call event occurs.
         * */
        private void CallEventCallback(IDictionary<String, Object> data)
        {
            // Check if on different thread?
            if (this.InvokeRequired)
            {
                this.Invoke(new CallEvent(this.CallEventCallback), data);
                return;
            }

            if (data.ContainsKey("direction") && data["direction"].ToString() == "in")
            {
                if (data.ContainsKey("event") && data["event"].ToString() == "pickup")
                {
                    eventBox.Text += "picked up call\n";
                }
                else if (data.ContainsKey("event") && data["event"].ToString() == "hangup")
                {
                    eventBox.Text += "Call disconnected";
                    if (data.ContainsKey("hangupReason"))
                        eventBox.Text += ": " + data["hangupReason"];
                    if (data.ContainsKey("billsec"))
                        eventBox.Text += ", duration: " + data["billsec"];
                    eventBox.Text += "\n";
                }
                else
                {
                    eventBox.Text += "Incoming call";

                    if (data.ContainsKey("callerId"))
                    {
                        IDictionary<String, Object> callerId = (IDictionary<String, Object>)data["callerId"];
                        if (callerId.ContainsKey("name"))
                            eventBox.Text += " from " + callerId["name"];
                        else if (callerId.ContainsKey("number"))
                            eventBox.Text += " from " + callerId["number"];
                        if (data.ContainsKey("userId"))
                            eventBox.Text += " to user " + data["userId"];
                    }
                
                    eventBox.Text += "\n";
                }
            }
        }
    }
}
