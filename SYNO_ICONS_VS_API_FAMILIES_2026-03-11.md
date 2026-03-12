# Synology Icons vs API Families (2026-03-11)

Source used:
- Icons: `/OpenClaw/assets/syno_icons` via FileStation API
- APIs: `SYNO.API.Info query=all`

## Counts
- Icons (.png): **47**
- API families (2nd token of `SYNO.*`): **61**
- Matched families (name/alias heuristic): **22**
- API families without matching icon: **39**
- Icons without matching API family: **25**

## Matched examples
- ActiveBackup -> ActiveBackup
- ActiveInsight -> ActiveInsight
- AudioStation -> AudioStation
- Cal -> Calendar
- Chat -> Chat
- CloudSync -> CloudSync
- Contacts -> Contacts
- DownloadStation -> DownloadStation
- FileStation -> FileBrowser
- LogCenter -> LogCenter
- MailClient -> MailClient
- MailPlusServer -> MailPlus-Server
- NoteStation -> NoteStation
- OAUTH -> OAuthService
- Office -> Office
- ResourceMonitor -> ResourceMonitor
- SecurityAdvisor -> SecurityScan
- Storage -> StorageAnalyzer
- SynologyDrive -> SynologyDrive
- TextEditor -> TextEditor
- USBCopy -> USBCopy
- WebStation -> WebStation

## API families not matched to an icon (39)
AI, AME, API, AddressBook, AudioPlayer, Auth, Backup, Btrfs, C2FS, Core, DR, DSM, Default, DiagnosisTool, DisasterRecovery, Docker, DownloadStation2, Entry, Finder, FolderSharing, Foto, FotoTeam, License, Lunbackup, Package, PersonMailAccount, Personal, Remote, Replica, S2S, SAS, SecureSignIn, ShareLink, Snap, SupportService, SynologyDriveShareSync, Utils, VideoPlayer, WebRTC

## Icons not matched to an API family (25)
AIConsole, ActiveBackup-Portal, AdminCenter, CodecPack, ContainerManager, Document, DocumentViewer, HelpBrowser, HybridShare, OTPWizard, PDFViewer, PersonalSettings, PhotoViewer, PkgManApp, Presentation, ScsiTarget, SnapshotReplication, Spreadsheet, SupportForm, SynoFinder, SynologyApplicationService, SynologyDrive-Drive, SynologyPhotos, UniversalViewer, WebService

## Notes
- Matching is not strict 1:1 by design: icon names are app/product branding while API families are technical namespaces.
- Some families map to differently named icons (`FileStation -> FileBrowser`, `Cal -> Calendar`, etc.).
