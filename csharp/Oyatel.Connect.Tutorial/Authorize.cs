/*
 * Opens a webbrowser window with a login prompt, and retrieves the users access token.
 * */
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace Oyatel.Connect.Tutorial
{
    /*
     * Class used for requesting an access_token trough Oyatel Connect.
     * */
    public class Authorize
    {
        public delegate void AuthorizationResponse(bool success, String error);
        private AuthorizationResponse authorized;
        private Form popup = null;
        private bool canClosePopup = false;
        private String client_id;
        private String redirect_uri;
        private String _access_token = "";

        /*
         * Get your client_id when registering your app at dev.oyatel.com
         * */
        public Authorize(String client_id, String redirect_uri, AuthorizationResponse callback)
        {
            this.client_id = client_id;
            this.redirect_uri = redirect_uri;
            authorized = callback;
        }

        public String access_token
        {
            get
            {
                return _access_token;
            }
        }

        /*
         * Popup a webbrowser-window with the Oyatel Connect prompt.
         * */
        public void loginPopup()
        {
            _access_token = "";

            popup = new Form();
            canClosePopup = false;
            WebBrowser webBrowser = new WebBrowser();
            popup.SuspendLayout();

            webBrowser.Location = new System.Drawing.Point(0, 0);
            webBrowser.MinimumSize = new System.Drawing.Size(20, 20);
            webBrowser.Name = "webBrowser";
            webBrowser.Size = new System.Drawing.Size(880, 550);

            popup.Width = 900;
            popup.Height = 570;
            popup.Text = "Oyatel Connect";
            popup.Visible = true;

            popup.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            popup.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            popup.ClientSize = new System.Drawing.Size(880, 550);
            popup.Controls.Add(webBrowser);
            popup.Name = "Oyatel.Connect";
            popup.Text = "Oyatel Connect";
            popup.ResumeLayout(false);
            popup.PerformLayout();

            webBrowser.Visible = true;
            webBrowser.Navigated += new WebBrowserNavigatedEventHandler(navigated_event);
            webBrowser.ProgressChanged += new WebBrowserProgressChangedEventHandler(ProgressChanged);
            webBrowser.Navigate("https://oauth.oyatel.com/oauth/authorize?client_id="
                + client_id + "&response_type=token&redirect_uri=" + redirect_uri, false);
        }

        /*
         * This event is triggered after page redirection. We use it to get the access_token from a successful login.
         * */
        private void navigated_event(object sender, WebBrowserNavigatedEventArgs e)
        {
            String url = e.Url.ToString();

            // If the page starts with redirect_uri and contains an access_token, we have a successful login!
            if (url.StartsWith(redirect_uri))
            {
                String parameters = url.Substring(url.LastIndexOf('?') + 1);
                Dictionary<String, String> D = new Dictionary<String, String>();

                int i = 0;
                String key = "";

                foreach (String s in parameters.Split(new Char[] { '=', '&', '#' }))
                {
                    if (i % 2 == 0) key = s;
                    else D.Add(key, s);

                    i++;
                }

                if (!D.ContainsKey("error"))
                {
                    // Successful login
                    if (D.ContainsKey("access_token"))
                    {
                        _access_token = D["access_token"];
                        authorized(true, "");
                    }
                    else
                    {
                        authorized(false, "missing access_token");
                    }
                }
                else
                {
                    authorized(false, D["error"]);
                }

                ((WebBrowser)sender).Stop();
                canClosePopup = true;
            }
        }

        /*
         * The DocumentCompleted-event gets triggered before the document is finished after a successful login.
         * So we listen for an empty ProgressChanged-event instead.
         * */
        private void ProgressChanged(object sender, WebBrowserProgressChangedEventArgs e)
        {
            if (e.CurrentProgress == 0 && e.MaximumProgress == 0 && popup != null && canClosePopup)
            {
                // Close popup-window:
                ((WebBrowser)sender).Dispose();
                popup.Close();
                popup = null;

                canClosePopup = false;
            }
        }
    }
}
