# QuickServerMute

[![Language: English](https://img.shields.io/badge/lang-English-blue.svg)](README.md)
[![Langue : Français](https://img.shields.io/badge/lang-Fran%C3%A7ais-red.svg)](README.fr.md)

A [BetterDiscord](https://betterdiscord.app/) plugin that adds a one-click mute button to every server **and folder** in the left server bar, plus a clear visual indicator so you can see at a glance what is muted.

Tired of right-clicking server after server and going through the menu just to mute notifications? This plugin puts a small bell button directly on each server icon and on each folder.

## Features

- **One-click mute/unmute** — a small bell button on every server icon.
- **Folder support** — mute/unmute every server inside a folder at once with a single click.
- **Visual state** — muted servers show a red bell button that stays visible, and the icon is greyed out. A folder is red when all its servers are muted and orange when only some of them are.
- **Hover button** — on non-muted items, the button appears when you hover the icon, so your server list stays clean.
- **Live updates** — if you change notification settings anywhere else in Discord, the indicator updates automatically.
- **Toast confirmation** — a small notification confirms each mute/unmute.
- **Keyboard accessible** — the button can be focused with `Tab` and triggered with `Enter` / `Space`.

## How it works

Discord does not offer a per-server (or per-folder) mute toggle in the server list, so this plugin adds one:

1. It watches the server list (`data-list-item-id="guildsnav___<serverId>"` for servers and `guildsnav___<folderId>` for folders) with a `MutationObserver`.
2. For each server, it injects a small button in the top-left corner of the icon.
3. Clicking a server button calls Discord's internal `updateGuildNotificationSettings` action to set that server's notification settings to muted (permanent) or unmuted.
4. Clicking a folder button does the same for every server inside the folder (mute all if not all are muted, unmute all otherwise). Folders are resolved through Discord's `SortedGuildStore`.
5. The muted state is read from Discord's `UserGuildSettingsStore` and the UI is refreshed whenever Discord fires a user-guild-settings update event.

No data leaves your client. The plugin only uses Discord's own internal APIs, exactly like the right-click → *Mute Server* menu option.

## Requirements

- Discord Desktop (the plugin does **not** work on the browser version).
- [BetterDiscord](https://betterdiscord.app/) installed.

## Installation

1. Install [BetterDiscord](https://betterdiscord.app/) if you haven't already (close Discord, run the installer, then reopen Discord).
2. Download `QuickServerMute.plugin.js` from this repository.
3. Place the file in your BetterDiscord plugins folder:
   - **Windows:** `%AppData%\BetterDiscord\plugins`
   - **macOS:** `~/Library/Application Support/BetterDiscord/plugins`
   - **Linux:** `~/.config/BetterDiscord/plugins`
   - The folder is created automatically the first time BetterDiscord runs.
4. In Discord, open **Settings → BetterDiscord → Plugins**.
5. Enable **QuickServerMute** with the toggle.

The buttons appear immediately on the server bar.

## Usage

- **Hover** a server icon: a bell button appears in the top-left corner.
- **Click** the bell to mute the server. The button turns red and stays visible.
- **Click** it again to unmute.
- Muted servers also have their icon greyed out for quick scanning.
- **Folders** work the same way: hover a folder and click its bell to mute every server inside it. Click again to unmute all of them. The folder button is red when all servers are muted and orange when only some are.

## Troubleshooting

- **No button appears / mute does nothing:** open the developer console (`Ctrl+Shift+I`) and look for `[QuickServerMute]` messages, then open an issue with the logs. Discord updates its internals regularly and selectors may need a small fix.
- **Button is not visible:** hover the server icon — the button is hidden until hover for non-muted servers.

## Uninstall

1. Disable **QuickServerMute** in **Settings → BetterDiscord → Plugins**.
2. Delete `QuickServerMute.plugin.js` from the plugins folder.

## Disclaimer

This plugin uses Discord's internal, undocumented modules. They can change at any time and may break the plugin until it is updated. Use at your own risk.

## License

MIT
