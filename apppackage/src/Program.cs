using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("OURSPACE Standalone Desktop")]
[assembly: AssemblyDescription("Two Hearts. One Private Digital World.")]
[assembly: AssemblyCompany("OURSPACE")]
[assembly: AssemblyProduct("OURSPACE")]
[assembly: AssemblyCopyright("Copyright © 2026 OURSPACE. All rights reserved.")]
[assembly: AssemblyVersion("2.3.0.0")]
[assembly: AssemblyFileVersion("2.3.0.0")]

namespace OurSpace.Desktop
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            // Uninstallation routine if invoked with --uninstall
            if (args.Length > 0 && args[0].Equals("--uninstall", StringComparison.OrdinalIgnoreCase))
            {
                RunUninstaller();
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new StandaloneAppForm());
        }

        static void RunUninstaller()
        {
            DialogResult res = MessageBox.Show(
                "Are you sure you want to completely uninstall OURSPACE from your system?",
                "OURSPACE Uninstaller",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question);

            if (res != DialogResult.Yes) return;

            try
            {
                // Remove shortcuts
                string desktopShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "OURSPACE.lnk");
                if (File.Exists(desktopShortcut)) File.Delete(desktopShortcut);

                string startMenuShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", "OURSPACE.lnk");
                if (File.Exists(startMenuShortcut)) File.Delete(startMenuShortcut);

                // Remove registry key
                using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall", true))
                {
                    if (key != null)
                    {
                        key.DeleteSubKeyTree("OURSPACE", false);
                    }
                }

                MessageBox.Show(
                    "OURSPACE has been uninstalled successfully. Your private data was preserved.",
                    "Uninstallation Complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Uninstallation encountered an issue: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    /// <summary>
    /// OURSPACE Standalone Native Desktop Sanctuary Window
    /// Hosts the application interface directly within its own native frame.
    /// Does not open an external Chrome or Edge browser window.
    /// </summary>
    public class StandaloneAppForm : Form
    {
        private WebBrowser browserControl;
        private Panel topNavigationPanel;
        private Label lblLogo;
        private Label lblStatus;
        private Button btnHome;
        private Button btnChat;
        private Button btnAlbums;
        private Button btnLocker;
        private Button btnReload;
        private NotifyIcon trayIcon;

        private string GetAppUrl()
        {
            string envUrl = Environment.GetEnvironmentVariable("OURSPACE_URL");
            if (!string.IsNullOrEmpty(envUrl)) return envUrl;

            string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            if (File.Exists(configPath))
            {
                try
                {
                    string content = File.ReadAllText(configPath);
                    int idx = content.IndexOf("\"url\"");
                    if (idx >= 0)
                    {
                        int colon = content.IndexOf(':', idx);
                        int quote1 = content.IndexOf('"', colon);
                        int quote2 = content.IndexOf('"', quote1 + 1);
                        if (quote1 >= 0 && quote2 > quote1)
                        {
                            return content.Substring(quote1 + 1, quote2 - quote1 - 1);
                        }
                    }
                }
                catch { }
            }
            return "https://ourspace-app-two.vercel.app";
        }

        public StandaloneAppForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            string targetUrl = GetAppUrl();

            this.Text = "OURSPACE — Two Hearts. One Private Digital World.";
            this.Size = new Size(1280, 860);
            this.MinimumSize = new Size(960, 640);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(250, 248, 245);

            // Attempt to load application icon
            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
            if (!File.Exists(iconPath))
            {
                iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "assets", "icons", "icon.ico");
            }
            if (File.Exists(iconPath))
            {
                try { this.Icon = new Icon(iconPath); } catch { }
            }

            // Custom Romantic Header Bar
            topNavigationPanel = new Panel();
            topNavigationPanel.Dock = DockStyle.Top;
            topNavigationPanel.Height = 52;
            topNavigationPanel.BackColor = Color.FromArgb(255, 255, 255);
            topNavigationPanel.BorderStyle = BorderStyle.FixedSingle;

            // Brand Logo Title
            lblLogo = new Label();
            lblLogo.Text = "OURSPACE";
            lblLogo.Font = new Font("Segoe UI", 13, FontStyle.Bold);
            lblLogo.ForeColor = Color.FromArgb(244, 63, 94); // Romantic Rose Accent
            lblLogo.AutoSize = true;
            lblLogo.Location = new Point(16, 14);
            topNavigationPanel.Controls.Add(lblLogo);

            // In-Window Fast Navigation Buttons
            int leftOffset = 150;

            btnHome = CreateNavButton("Home", leftOffset, () => browserControl.Navigate(targetUrl + "/dashboard"));
            topNavigationPanel.Controls.Add(btnHome);
            leftOffset += 80;

            btnChat = CreateNavButton("Chat", leftOffset, () => browserControl.Navigate(targetUrl + "/dashboard/chat"));
            topNavigationPanel.Controls.Add(btnChat);
            leftOffset += 80;

            btnAlbums = CreateNavButton("Albums", leftOffset, () => browserControl.Navigate(targetUrl + "/dashboard/albums"));
            topNavigationPanel.Controls.Add(btnAlbums);
            leftOffset += 90;

            btnLocker = CreateNavButton("Locker", leftOffset, () => browserControl.Navigate(targetUrl + "/dashboard/locker"));
            topNavigationPanel.Controls.Add(btnLocker);
            leftOffset += 90;

            btnReload = CreateNavButton("↻ Refresh", leftOffset, () => browserControl.Refresh());
            topNavigationPanel.Controls.Add(btnReload);

            // Connection Status Indicator
            lblStatus = new Label();
            lblStatus.Text = "● Connected to Private Sanctuary";
            lblStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblStatus.ForeColor = Color.FromArgb(16, 185, 129); // Green Dot
            lblStatus.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            lblStatus.AutoSize = true;
            lblStatus.Location = new Point(this.ClientSize.Width - 230, 16);
            topNavigationPanel.Controls.Add(lblStatus);

            this.Controls.Add(topNavigationPanel);

            // Embedded Browser Control (Renders UI inside this application window)
            browserControl = new WebBrowser();
            browserControl.Dock = DockStyle.Fill;
            browserControl.ScriptErrorsSuppressed = true; // Prevents IE script popups
            browserControl.IsWebBrowserContextMenuEnabled = false;
            browserControl.ScrollBarsEnabled = true;

            // Trap all navigation inside this application window
            browserControl.NewWindow += (s, e) => {
                // Cancel external window popup and navigate internally
                e.Cancel = true;
                string newUrl = browserControl.StatusText;
                if (!string.IsNullOrEmpty(newUrl))
                {
                    browserControl.Navigate(newUrl);
                }
            };

            this.Controls.Add(browserControl);
            browserControl.BringToFront();

            // Setup Tray Icon for Minimization
            try
            {
                trayIcon = new NotifyIcon();
                trayIcon.Text = "OURSPACE — Private Sanctuary";
                trayIcon.Visible = true;
                if (this.Icon != null)
                {
                    trayIcon.Icon = this.Icon;
                }
                else
                {
                    trayIcon.Icon = SystemIcons.Application;
                }
                trayIcon.DoubleClick += (s, e) => {
                    this.Show();
                    this.WindowState = FormWindowState.Normal;
                    this.BringToFront();
                };
            }
            catch { }

            // Initial Navigation
            browserControl.Navigate(targetUrl);
        }

        private Button CreateNavButton(string text, int left, Action onClick)
        {
            Button btn = new Button();
            btn.Text = text;
            btn.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btn.Size = new Size(76, 32);
            btn.Location = new Point(left, 10);
            btn.BackColor = Color.FromArgb(255, 241, 242);
            btn.ForeColor = Color.FromArgb(225, 29, 72);
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderSize = 0;
            btn.Cursor = Cursors.Hand;
            btn.Click += (s, e) => onClick();
            return btn;
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            base.OnFormClosing(e);
        }
    }
}
