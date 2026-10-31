# OURSPACE Windows Desktop Application (v2.3.0)

**Two Hearts. One Private Digital World.**

Official standalone desktop release for Windows 10 and Windows 11 (64-bit & 32-bit compatible).

---

## Artifacts in this Release

| File | Type | Description |
|---|---|---|
| `OURSPACE-Windows-Setup-v2.3.0.exe` | Standalone Installer | Full graphical installer with desktop & Start Menu shortcuts, uninstaller registration, and launch options. |
| `OURSPACE-Windows-Portable-v2.3.0.exe` | Portable Executable | Zero-install standalone desktop executable. Runs directly from USB or any local directory. |

---

## Standalone Native Architecture

Unlike previous versions or shortcuts that merely delegated to an external browser like Chrome or Edge:
1. **In-Window Rendering**: The application runs completely inside its own dedicated native Windows application window.
2. **Dedicated Titlebar & Tray Navigation**: Supports fast tab navigation (Home, Chat, Albums, Locker) and minimizes to the system notification tray for couple alerts.
3. **Electron Engine Compatibility**: Also available via the `apps/desktop` Electron runtime with preload security bridges and native system notification APIs.
4. **Clean Uninstall**: Registers in Windows Control Panel (`Settings > Apps > Installed apps`) with full uninstaller support and user data preservation.

---

## System Requirements

- **Operating System**: Windows 10 (Build 1809+) or Windows 11.
- **Architecture**: x64, ARM64 (emulated), x86.
- **Runtime**: Pre-bundled with standard Windows Desktop Application Framework. No external browser installation required.
- **Internet Connectivity**: Active connection required for live Firebase synchronization and WebRTC calling.
