namespace Oyatel.Connect.Tutorial
{
    partial class DemoForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.connect_button = new System.Windows.Forms.Button();
            this.eventBox = new System.Windows.Forms.RichTextBox();
            this.topBox = new System.Windows.Forms.RichTextBox();
            this.SuspendLayout();
            // 
            // connect_button
            // 
            this.connect_button.Location = new System.Drawing.Point(16, 329);
            this.connect_button.Name = "connect_button";
            this.connect_button.Size = new System.Drawing.Size(434, 32);
            this.connect_button.TabIndex = 0;
            this.connect_button.Text = "Connect to Oyatel";
            this.connect_button.UseVisualStyleBackColor = true;
            this.connect_button.Click += new System.EventHandler(this.button1_Click);
            // 
            // eventBox
            // 
            this.eventBox.Location = new System.Drawing.Point(12, 121);
            this.eventBox.Name = "eventBox";
            this.eventBox.Size = new System.Drawing.Size(440, 198);
            this.eventBox.TabIndex = 2;
            this.eventBox.Text = "";
            // 
            // topBox
            // 
            this.topBox.Location = new System.Drawing.Point(12, 13);
            this.topBox.Name = "topBox";
            this.topBox.Size = new System.Drawing.Size(438, 96);
            this.topBox.TabIndex = 3;
            this.topBox.Text = "";
            // 
            // DemoForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(462, 373);
            this.Controls.Add(this.topBox);
            this.Controls.Add(this.eventBox);
            this.Controls.Add(this.connect_button);
            this.Name = "DemoForm";
            this.Text = "Oyatel Connect Demo";
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Button connect_button;
        private System.Windows.Forms.RichTextBox eventBox;
        private System.Windows.Forms.RichTextBox topBox;
    }
}

