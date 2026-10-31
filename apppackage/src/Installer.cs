using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("OURSPACE Setup Wizard")]
[assembly: AssemblyDescription("OURSPACE Windows Desktop Setup Installer")]
[assembly: AssemblyCompany("OURSPACE")]
[assembly: AssemblyProduct("OURSPACE")]
[assembly: AssemblyCopyright("Copyright © 2026 OURSPACE. All rights reserved.")]
[assembly: AssemblyVersion("2.3.0.0")]
[assembly: AssemblyFileVersion("2.3.0.0")]

namespace OurSpace.Installer
{
    static class SetupProgram
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }

    public class SetupForm : Form
    {
        private TextBox txtInstallPath;
        private CheckBox chkDesktopShortcut;
        private CheckBox chkStartMenuShortcut;
        private CheckBox chkLaunchAfter;
        private Button btnBrowse;
        private Button btnInstall;
        private Button btnCancel;
        private ProgressBar progressBar;
        private Label lblStatus;

        public SetupForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "OURSPACE v2.3.0 Setup Wizard";
            this.Size = new Size(580, 420);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(250, 248, 245);

            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
            if (!File.Exists(iconPath))
            {
                iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "assets", "icons", "icon.ico");
            }
            if (File.Exists(iconPath))
            {
                try { this.Icon = new Icon(iconPath); } catch { }
            }

            // Romantic Header Banner
            Panel banner = new Panel();
            banner.Dock = DockStyle.Top;
            banner.Height = 85;
            banner.BackColor = Color.FromArgb(255, 241, 242);
            banner.BorderStyle = BorderStyle.FixedSingle;

            Label lblTitle = new Label();
            lblTitle.Text = "OURSPACE — Two Hearts. One Private Digital World.";
            lblTitle.Font = new Font("Segoe UI", 12.5f, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(225, 29, 72);
            lblTitle.Location = new Point(20, 16);
            lblTitle.AutoSize = true;
            banner.Controls.Add(lblTitle);

            Label lblSubtitle = new Label();
            lblSubtitle.Text = "Official Standalone Windows Application Installer (v2.3.0)";
            lblSubtitle.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(100, 116, 139);
            lblSubtitle.Location = new Point(22, 46);
            lblSubtitle.AutoSize = true;
            banner.Controls.Add(lblSubtitle);

            this.Controls.Add(banner);

            // Install Location Group
            Label lblLocation = new Label();
            lblLocation.Text = "Destination Folder:";
            lblLocation.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            lblLocation.Location = new Point(25, 105);
            lblLocation.AutoSize = true;
            this.Controls.Add(lblLocation);

            string defaultPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", "OURSPACE");

            txtInstallPath = new TextBox();
            txtInstallPath.Text = defaultPath;
            txtInstallPath.Font = new Font("Segoe UI", 9.5f);
            txtInstallPath.Location = new Point(25, 130);
            txtInstallPath.Size = new Size(410, 26);
            this.Controls.Add(txtInstallPath);

            btnBrowse = new Button();
            btnBrowse.Text = "Browse...";
            btnBrowse.Font = new Font("Segoe UI", 9f);
            btnBrowse.Location = new Point(445, 128);
            btnBrowse.Size = new Size(95, 29);
            btnBrowse.Click += (s, e) => {
                using (var fbd = new FolderBrowserDialog())
                {
                    fbd.SelectedPath = txtInstallPath.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        txtInstallPath.Text = Path.Combine(fbd.SelectedPath, "OURSPACE");
                    }
                }
            };
            this.Controls.Add(btnBrowse);

            // Options
            chkDesktopShortcut = new CheckBox();
            chkDesktopShortcut.Text = "Create desktop shortcut";
            chkDesktopShortcut.Font = new Font("Segoe UI", 9.5f);
            chkDesktopShortcut.Checked = true;
            chkDesktopShortcut.Location = new Point(28, 175);
            chkDesktopShortcut.AutoSize = true;
            this.Controls.Add(chkDesktopShortcut);

            chkStartMenuShortcut = new CheckBox();
            chkStartMenuShortcut.Text = "Create Start Menu shortcut";
            chkStartMenuShortcut.Font = new Font("Segoe UI", 9.5f);
            chkStartMenuShortcut.Checked = true;
            chkStartMenuShortcut.Location = new Point(28, 205);
            chkStartMenuShortcut.AutoSize = true;
            this.Controls.Add(chkStartMenuShortcut);

            chkLaunchAfter = new CheckBox();
            chkLaunchAfter.Text = "Launch OURSPACE when installation finishes";
            chkLaunchAfter.Font = new Font("Segoe UI", 9.5f);
            chkLaunchAfter.Checked = true;
            chkLaunchAfter.Location = new Point(28, 235);
            chkLaunchAfter.AutoSize = true;
            this.Controls.Add(chkLaunchAfter);

            // Progress & Status
            lblStatus = new Label();
            lblStatus.Text = "Ready to install.";
            lblStatus.Font = new Font("Segoe UI", 9f, FontStyle.Italic);
            lblStatus.ForeColor = Color.FromArgb(71, 85, 105);
            lblStatus.Location = new Point(25, 275);
            lblStatus.Size = new Size(515, 20);
            this.Controls.Add(lblStatus);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(25, 300);
            progressBar.Size = new Size(515, 20);
            progressBar.Visible = false;
            this.Controls.Add(progressBar);

            // Action Buttons
            btnInstall = new Button();
            btnInstall.Text = "Install";
            btnInstall.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btnInstall.BackColor = Color.FromArgb(225, 29, 72);
            btnInstall.ForeColor = Color.White;
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Size = new Size(110, 34);
            btnInstall.Location = new Point(310, 335);
            btnInstall.Click += BtnInstall_Click;
            this.Controls.Add(btnInstall);

            btnCancel = new Button();
            btnCancel.Text = "Cancel";
            btnCancel.Font = new Font("Segoe UI", 9.5f);
            btnCancel.Size = new Size(110, 34);
            btnCancel.Location = new Point(430, 335);
            btnCancel.Click += (s, e) => this.Close();
            this.Controls.Add(btnCancel);
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            string targetDir = txtInstallPath.Text.Trim();
            if (string.IsNullOrEmpty(targetDir))
            {
                MessageBox.Show("Please specify a valid install path.", "Validation", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            btnInstall.Enabled = false;
            btnBrowse.Enabled = false;
            progressBar.Visible = true;
            progressBar.Value = 20;
            lblStatus.Text = "Creating installation directory...";

            try
            {
                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                progressBar.Value = 40;
                lblStatus.Text = "Copying standalone application binaries...";

                string sourceExe = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "OURSPACE-Windows-Portable-v2.3.0.exe");
                if (!File.Exists(sourceExe))
                {
                    sourceExe = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "OURSPACE-Windows-v2.3.0.exe");
                }
                if (!File.Exists(sourceExe))
                {
                    sourceExe = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "OURSPACE.exe");
                }

                string destExe = Path.Combine(targetDir, "OURSPACE.exe");
                if (File.Exists(sourceExe))
                {
                    File.Copy(sourceExe, destExe, true);
                }

                // Copy icon
                string srcIcon = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
                if (!File.Exists(srcIcon))
                {
                    srcIcon = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "assets", "icons", "icon.ico");
                }
                string destIcon = Path.Combine(targetDir, "icon.ico");
                if (File.Exists(srcIcon))
                {
                    File.Copy(srcIcon, destIcon, true);
                }

                // Write app config
                string configContent = "{\n  \"name\": \"OURSPACE\",\n  \"version\": \"2.3.0\",\n  \"url\": \"https://ourspace-app-two.vercel.app\",\n  \"installedAt\": \"" + DateTime.UtcNow.ToString("o") + "\"\n}";
                File.WriteAllText(Path.Combine(targetDir, "config.json"), configContent);

                progressBar.Value = 70;
                lblStatus.Text = "Registering shortcuts and uninstaller...";

                // Create Desktop Shortcut
                if (chkDesktopShortcut.Checked)
                {
                    string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                    CreateShortcut(Path.Combine(desktopPath, "OURSPACE.lnk"), destExe, targetDir, destIcon, "OURSPACE — Two Hearts. One Private Digital World.");
                }

                // Create Start Menu Shortcut
                if (chkStartMenuShortcut.Checked)
                {
                    string startMenu = Environment.GetFolderPath(Environment.SpecialFolder.StartMenu);
                    string progFolder = Path.Combine(startMenu, "Programs");
                    CreateShortcut(Path.Combine(progFolder, "OURSPACE.lnk"), destExe, targetDir, destIcon, "OURSPACE — Two Hearts. One Private Digital World.");
                }

                // Register in Windows Add/Remove Programs (Registry)
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\OURSPACE"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "OURSPACE");
                        key.SetValue("DisplayVersion", "2.3.0");
                        key.SetValue("Publisher", "OURSPACE");
                        key.SetValue("InstallLocation", targetDir);
                        key.SetValue("DisplayIcon", destExe);
                        key.SetValue("UninstallString", "\"" + destExe + "\" --uninstall");
                        key.SetValue("URLInfoAbout", "https://ourspace-app-two.vercel.app");
                        key.SetValue("EstimatedSize", 10240); // in KB
                    }
                }

                progressBar.Value = 100;
                lblStatus.Text = "Installation complete!";

                MessageBox.Show(
                    "OURSPACE v2.3.0 has been successfully installed!\n\nLocation: " + targetDir,
                    "Installation Complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);

                if (chkLaunchAfter.Checked && File.Exists(destExe))
                {
                    System.Diagnostics.Process.Start(destExe);
                }

                this.Close();
            }
            catch (Exception ex)
            {
                lblStatus.Text = "Installation failed: " + ex.Message;
                MessageBox.Show("An error occurred during installation:\n" + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                btnInstall.Enabled = true;
                btnBrowse.Enabled = true;
            }
        }

        private void CreateShortcut(string shortcutPath, string targetPath, string workingDir, string iconPath, string description)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetPath;
                    shortcut.WorkingDirectory = workingDir;
                    shortcut.Description = description;
                    if (File.Exists(iconPath))
                    {
                        shortcut.IconLocation = iconPath + ",0";
                    }
                    shortcut.Save();
                }
            }
            catch { }
        }
    }
}
