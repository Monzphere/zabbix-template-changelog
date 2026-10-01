# Zabbix ChangeLog by GitHub — Zabbix Template
![Stars](https://img.shields.io/github/stars/Monzphere/zabbix-template-changelog?style=social)
![Forks](https://img.shields.io/github/forks/Monzphere/zabbix-template-changelog?style=social)
![Issues](https://img.shields.io/github/issues/Monzphere/zabbix-template-changelog)

Monitors the `ChangeLog` of the official Zabbix repository on GitHub ([zabbix/zabbix](https://github.com/zabbix/zabbix)) and raises a problem whenever it changes or a new version section appears — so you know about new features and fixes as soon as they land.

No external scripts, agents or webhooks: a single **Script item** (JavaScript) runs on the Zabbix server or proxy.

## Features

- Problem on every ChangeLog change, with the commit, its title and author in the event name.
- Separate problem when a new version section (`Changes for X.Y.Z`) appears.
- Latest version section collected as text, with counts of new features and bug fixes.
- Works without a GitHub token (one API request per check); a token is optional.
- Downloads only the beginning of the ChangeLog (HTTP `Range`), not the whole 2 MB file.
- Follows any branch, for example `master` or `release/8.0`.
- Monitors its own health: no data from GitHub and GitHub API rate limit.

## Requirements

- Zabbix 8.0 or newer (tested with 8.0.0rc1).
- The Zabbix server or proxy that monitors the host must reach `api.github.com` and `raw.githubusercontent.com` over HTTPS, directly or through an HTTP proxy.

## Installation

1. Download [`template/zbx_changelog_github.yaml`](template/zbx_changelog_github.yaml).
2. In Zabbix go to **Data collection → Templates → Import** and import the file.
3. Create a host (no interface is needed), for example `Zabbix ChangeLog`, and link the template **Zabbix ChangeLog by GitHub**.
4. Optional: set `{$GITHUB.API.TOKEN}` and the other macros on the host.

The first check stores the current state without raising problems; the next change raises one.

## Macros

| Macro | Default | Description |
|---|---|---|
| `{$ZBX.CHANGELOG.REPO}` | `zabbix/zabbix` | GitHub repository in the `owner/name` format. |
| `{$ZBX.CHANGELOG.BRANCH}` | `master` | Branch to follow, for example `master` or `release/8.0`. |
| `{$ZBX.CHANGELOG.PATH}` | `ChangeLog` | Path of the ChangeLog file in the repository. |
| `{$ZBX.CHANGELOG.INTERVAL}` | `30m` | How often GitHub is checked. Every check uses one GitHub API request. |
| `{$ZBX.CHANGELOG.READ.BYTES}` | `65536` | Bytes read from the beginning of the ChangeLog; must include the whole latest section. |
| `{$ZBX.CHANGELOG.NODATA}` | `3h` | Period without data from GitHub after which a problem is raised. |
| `{$ZBX.CHANGELOG.HTTP.PROXY}` | | HTTP proxy for requests to GitHub. Empty: no proxy. |
| `{$GITHUB.API.TOKEN}` | | Optional GitHub token (secret macro); raises the API limit from 60 to 5000 requests per hour. |
| `{$GITHUB.API.RATELIMIT.MIN}` | `5` | Problem when fewer GitHub API requests than this remain in the current hour. |

## Items

| Name | Key | Description |
|---|---|---|
| Get ChangeLog data | `zbx.changelog.get` | Script item: latest ChangeLog commit and latest version section (master item). |
| Last ChangeLog commit | `zbx.changelog.commit` | Short SHA, title and author of the latest ChangeLog commit. |
| Last ChangeLog commit SHA | `zbx.changelog.sha` | Full commit SHA. |
| Last ChangeLog commit time | `zbx.changelog.date` | Commit time. |
| Last ChangeLog commit URL | `zbx.changelog.url` | Link to the commit on GitHub. |
| Latest version in ChangeLog | `zbx.changelog.version` | Version of the top `Changes for` section. |
| Latest version: entries | `zbx.changelog.entries` | Entries in the latest version section. |
| Latest version: new features | `zbx.changelog.features` | `New features` entries. |
| Latest version: bug fixes | `zbx.changelog.fixes` | `Bug fixes` entries. |
| Latest version: changes | `zbx.changelog.section` | Text of the latest version section. |
| GitHub API: requests remaining | `zbx.changelog.ratelimit.remaining` | API requests left in the current hour. |
| GitHub API: request limit | `zbx.changelog.ratelimit.limit` | API requests allowed per hour. |

## Triggers

| Name | Severity | Description |
|---|---|---|
| Zabbix ChangeLog: Updated in `{$ZBX.CHANGELOG.REPO}@{$ZBX.CHANGELOG.BRANCH}` | Information | A new commit changed the ChangeLog. Event name: `Zabbix ChangeLog updated: <sha> <title> (<author>)`. Closed manually. |
| Zabbix ChangeLog: New version section in `{$ZBX.CHANGELOG.REPO}@{$ZBX.CHANGELOG.BRANCH}` | Warning | The top `Changes for` section has a new version. Closed manually. |
| Zabbix ChangeLog: No data from GitHub for `{$ZBX.CHANGELOG.NODATA}` | Warning | The ChangeLog could not be read: network, proxy, token or rate limit. |
| Zabbix ChangeLog: GitHub API rate limit is almost exhausted | Warning | Set `{$GITHUB.API.TOKEN}` or increase `{$ZBX.CHANGELOG.INTERVAL}`. |

Change problems use **manual close**, so every update stays visible until someone reviews it. Add an action on the `scope: notice` tag to receive them by e-mail, Telegram, Slack and other media.

## How it works

On every check the Script item ([source](src/changelog.js)):

1. Asks the GitHub API for the latest commit that changed the ChangeLog on the branch (`GET /repos/{repo}/commits?path=ChangeLog&sha={branch}&per_page=1`).
2. Reads only the first `{$ZBX.CHANGELOG.READ.BYTES}` bytes of the ChangeLog at that commit from `raw.githubusercontent.com`, which do not count against the API limit.
3. Parses the latest `Changes for` section and returns everything as JSON; dependent items extract the values.

## Testing

To see the triggers fire without waiting for a real change, set `{$ZBX.CHANGELOG.BRANCH}` on the host to an older branch (for example `release/7.4`), wait for one check, then remove the host macro (back to `master`) and use **Execute now** on the *Get ChangeLog data* item.

---

Developed by [MonZphere](https://github.com/Monzphere).
