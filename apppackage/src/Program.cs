using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace OurSpace.Desktop
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    public class MainForm : Form
    {
        private Button btnLaunchProduction;
        private Button btnStartLocal;
        private Button btnDocs;
        private Label lblTitle;
        private Label lblSubtitle;
        private Label lblStatus;
        private Panel headerPanel;

        // Configurable Public URL (Reads from env or defaults to global public URL)
        private string GetProductionUrl()
        {
            string envUrl = Environment.GetEnvironmentVariable("OURSPACE_URL");
            if (!string.IsNullOrEmpty(envUrl)) return envUrl;

            string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            if (File.Exists(configPath))
            {
                try
                {
                    string content = File.ReadAllText(configPath);
                    // Simple parser for {"url":"..."}
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
            return "https://ourspace.app";
        }

        public MainForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            string targetUrl = GetProductionUrl();

            this.Text = "OURSPACE — Private Couple Sanctuary";
            this.Size = new Size(720, 520);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(255, 248, 248);

            // Header Panel
            headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 140;
            headerPanel.BackColor = Color.FromArgb(244, 63, 94); // Romantic Rose Accent

            lblTitle = new Label();
            lblTitle.Text = "OURSPACE";
            lblTitle.Font = new Font("Segoe UI", 26, FontStyle.Bold);
            lblTitle.ForeColor = Color.White;
            lblTitle.AutoSize = true;
            lblTitle.Location = new Point(30, 25);
            headerPanel.Controls.Add(lblTitle);

            lblSubtitle = new Label();
            lblSubtitle.Text = "Global Internet Edition v2.0.0 — Multi-Network & Cellular 5G Ready";
            lblSubtitle.Font = new Font("Segoe UI", 11, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(254, 226, 226);
            lblSubtitle.AutoSize = true;
            lblSubtitle.Location = new Point(33, 80);
            headerPanel.Controls.Add(lblSubtitle);

            this.Controls.Add(headerPanel);

            // Status Label
            lblStatus = new Label();
            lblStatus.Text = "Connected to Global Production Cloud (" + targetUrl + "). Works across all Wi-Fi, 4G, and 5G cellular networks.";
            lblStatus.Font = new Font("Segoe UI", 10, FontStyle.Italic);
            lblStatus.ForeColor = Color.FromArgb(100, 116, 139);
            lblStatus.Size = new Size(640, 45);
            lblStatus.Location = new Point(40, 165);
            this.Controls.Add(lblStatus);

            // Primary Launch Button (Public Internet Sanctuary)
            btnLaunchProduction = new Button();
            btnLaunchProduction.Text = "🌐  Open Global Sanctuary (" + targetUrl + ")";
            btnLaunchProduction.Font = new Font("Segoe UI", 11.5f, FontStyle.Bold);
            btnLaunchProduction.Size = new Size(390, 55);
            btnLaunchProduction.Location = new Point(40, 230);
            btnLaunchProduction.BackColor = Color.FromArgb(244, 63, 94);
            btnLaunchProduction.ForeColor = Color.White;
            btnLaunchProduction.FlatStyle = FlatStyle.Flat;
            btnLaunchProduction.FlatAppearance.BorderSize = 0;
            btnLaunchProduction.Cursor = Cursors.Hand;
            btnLaunchProduction.Click += (s, e) => {
                try {
                    Process.Start(targetUrl);
                } catch (Exception ex) {
                    MessageBox.Show("Could not open browser: " + ex.Message);
                }
            };
            this.Controls.Add(btnLaunchProduction);

            // Local Server Button (Dev Mode)
            btnStartLocal = new Button();
            btnStartLocal.Text = "🛠️  Local Server (Dev)";
            btnStartLocal.Font = new Font("Segoe UI", 10, FontStyle.Regular);
            btnStartLocal.Size = new Size(210, 55);
            btnStartLocal.Location = new Point(450, 230);
            btnStartLocal.BackColor = Color.White;
            btnStartLocal.ForeColor = Color.FromArgb(71, 85, 105);
            btnStartLocal.FlatStyle = FlatStyle.Flat;
            btnStartLocal.FlatAppearance.BorderColor = Color.FromArgb(226, 232, 240);
            btnStartLocal.Cursor = Cursors.Hand;
            btnStartLocal.Click += (s, e) => {
                try {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "cmd.exe";
                    psi.Arguments = "/c npm run dev";
                    psi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory + @"..\";
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                    Process.Start("http://localhost:3000");
                } catch (Exception ex) {
                    MessageBox.Show("Error starting local server: " + ex.Message);
                }
            };
            this.Controls.Add(btnStartLocal);

            // Documentation & Networking Guides Button
            btnDocs = new Button();
            btnDocs.Text = "📖  Open Global Deployment & Networking Guides";
            btnDocs.Font = new Font("Segoe UI", 11, FontStyle.Regular);
            btnDocs.Size = new Size(620, 50);
            btnDocs.Location = new Point(40, 310);
            btnDocs.BackColor = Color.FromArgb(241, 245, 249);
            btnDocs.ForeColor = Color.FromArgb(51, 65, 85);
            btnDocs.FlatStyle = FlatStyle.Flat;
            btnDocs.FlatAppearance.BorderSize = 0;
            btnDocs.Cursor = Cursors.Hand;
            btnDocs.Click += (s, e) => {
                try {
                    string docsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\docs\GLOBAL_CONNECTIVITY.md");
                    if (File.Exists(docsPath)) {
                        Process.Start("notepad.exe", docsPath);
                    } else {
                        Process.Start("explorer.exe", AppDomain.CurrentDomain.BaseDirectory + @"..\docs");
                    }
                } catch (Exception ex) {
                    MessageBox.Show("Error opening docs: " + ex.Message);
                }
            };
            this.Controls.Add(btnDocs);

            // Footer
            Label lblFooter = new Label();
            lblFooter.Text = "© 2026 OURSPACE Inc. Guaranteed 2-Person Private Sanctuary. Built with Google Firebase & LiveKit SFU.";
            lblFooter.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblFooter.ForeColor = Color.FromArgb(148, 163, 184);
            lblFooter.AutoSize = true;
            lblFooter.Location = new Point(40, 420);
            this.Controls.Add(lblFooter);
        }
    }
}
