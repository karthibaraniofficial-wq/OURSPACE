using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

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
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        private const int SW_RESTORE = 9;
        private static Mutex singleInstanceMutex;
        private static NotifyIcon trayIcon;
        private static Process appProcess;

        [STAThread]
        static void Main(string[] args)
        {
            // Uninstallation routine if invoked with --uninstall
            if (args.Length > 0 && args[0].Equals("--uninstall", StringComparison.OrdinalIgnoreCase))
            {
                RunUninstaller();
                return;
            }

            bool createdNew;
            singleInstanceMutex = new Mutex(true, "OURSPACE_SINGLE_INSTANCE_MUTEX_V23", out createdNew);

            if (!createdNew)
            {
                // Bring existing instance to front
                Process current = Process.GetCurrentProcess();
                foreach (Process p in Process.GetProcessesByName(current.ProcessName))
                {
                    if (p.Id != current.Id && p.MainWindowHandle != IntPtr.Zero)
                    {
                        ShowWindow(p.MainWindowHandle, SW_RESTORE);
                        SetForegroundWindow(p.MainWindowHandle);
                        break;
                    }
                }
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string targetUrl = GetAppUrl();
            string chromiumPath = FindChromiumRuntime();

            if (string.IsNullOrEmpty(chromiumPath) || !File.Exists(chromiumPath))
            {
                MessageBox.Show(
                    "A modern Chromium rendering engine (such as Microsoft Edge or WebView2) was not found on this system.\n\nPlease ensure Microsoft Edge or WebView2 Evergreen Runtime is installed.",
                    "OURSPACE Engine Requirement",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            // Launch standalone Chromium app container
            LaunchAppWindow(chromiumPath, targetUrl);

            // Initialize Background Tray Controller
            SetupTrayIcon(targetUrl, chromiumPath);

            Application.Run();
        }

        private static string GetAppUrl()
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

        private static string FindChromiumRuntime()
        {
            // 1. Check Edge 64-bit & 32-bit locations
            string[] candidatePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe"),
            };

            foreach (string path in candidatePaths)
            {
                if (File.Exists(path)) return path;
            }

            // 2. Check WebView2 Evergreen Directory
            string webViewDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "EdgeWebView", "Application");
            if (Directory.Exists(webViewDir))
            {
                try
                {
                    foreach (string subDir in Directory.GetDirectories(webViewDir))
                    {
                        string wvExe = Path.Combine(subDir, "msedgewebview2.exe");
                        if (File.Exists(wvExe)) return wvExe;
                        string edgeExe = Path.Combine(subDir, "msedge.exe");
                        if (File.Exists(edgeExe)) return edgeExe;
                    }
                }
                catch { }
            }

            // 3. Check App Paths in Registry
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"))
                {
                    if (key != null)
                    {
                        string regPath = key.GetValue(null) as string;
                        if (!string.IsNullOrEmpty(regPath) && File.Exists(regPath)) return regPath;
                    }
                }
            }
            catch { }

            // 4. Check Google Chrome
            string chromePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe");
            if (File.Exists(chromePath)) return chromePath;
            string chromeX86 = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe");
            if (File.Exists(chromeX86)) return chromeX86;

            return null;
        }

        private static void LaunchAppWindow(string enginePath, string url)
        {
            try
            {
                string dataDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "OURSPACE", "ProfileData");

                if (!Directory.Exists(dataDir))
                {
                    Directory.CreateDirectory(dataDir);
                }

                // Launch Chromium in dedicated standalone App Mode
                // --app ensures NO browser tabs, NO URL bar, and isolated desktop window
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = enginePath;
                psi.Arguments = string.Format(
                    "--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=1280,860 --app-id=\"ourspace-sanctuary\" --disable-features=Translate,OptimizationHints,MediaRouter --enable-features=OverlayScrollbar --hide-crash-restore-bubble --no-first-run --no-default-browser-check",
                    url,
                    dataDir);
                psi.UseShellExecute = false;

                appProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not launch OURSPACE standalone window: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void SetupTrayIcon(string targetUrl, string enginePath)
        {
            trayIcon = new NotifyIcon();
            trayIcon.Text = "OURSPACE — Two Hearts. One Private Digital World.";
            trayIcon.Visible = true;

            // Load icon
            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
            if (!File.Exists(iconPath))
            {
                iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "assets", "icons", "icon.ico");
            }
            if (File.Exists(iconPath))
            {
                try { trayIcon.Icon = new Icon(iconPath); } catch { trayIcon.Icon = SystemIcons.Application; }
            }
            else
            {
                trayIcon.Icon = SystemIcons.Application;
            }

            ContextMenu menu = new ContextMenu();
            menu.MenuItems.Add("💖 Open Sanctuary", (s, e) => LaunchAppWindow(enginePath, targetUrl + "/dashboard"));
            menu.MenuItems.Add("💬 Couple Chat", (s, e) => LaunchAppWindow(enginePath, targetUrl + "/dashboard/chat"));
            menu.MenuItems.Add("📸 Memory Albums", (s, e) => LaunchAppWindow(enginePath, targetUrl + "/dashboard/albums"));
            menu.MenuItems.Add("🔒 OUR LOCKER", (s, e) => LaunchAppWindow(enginePath, targetUrl + "/dashboard/locker"));
            menu.MenuItems.Add("-");
            menu.MenuItems.Add("❌ Exit OURSPACE", (s, e) => {
                trayIcon.Visible = false;
                trayIcon.Dispose();
                Application.Exit();
            });

            trayIcon.ContextMenu = menu;
            trayIcon.DoubleClick += (s, e) => LaunchAppWindow(enginePath, targetUrl + "/dashboard");
        }

        private static void RunUninstaller()
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
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall", true))
                {
                    if (key != null)
                    {
                        key.DeleteSubKeyTree("OURSPACE", false);
                    }
                }

                // Ask user regarding local data
                DialogResult clearData = MessageBox.Show(
                    "Do you also want to remove local cached files and profile data?",
                    "Data Cleanup",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question);

                if (clearData == DialogResult.Yes)
                {
                    string dataDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "OURSPACE");
                    if (Directory.Exists(dataDir))
                    {
                        Directory.Delete(dataDir, true);
                    }
                }

                MessageBox.Show(
                    "OURSPACE has been uninstalled successfully.",
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
}
