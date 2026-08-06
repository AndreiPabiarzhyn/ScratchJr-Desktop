// M6: whole-library backup/restore (see PLAN.md) - shared by the Settings
// screen (Lobby.js) and the in-editor shortcut (editor.html).
export default class Backup {
    static download () {
        const bytes = window.tablet.dbManager.exportDatabase();
        const blob = new Blob([bytes], {type: 'application/x-sqlite3'});
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'scratchjr-backup.sqlite';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    static async restore (file) {
        const buffer = await file.arrayBuffer();
        await window.tablet.dbManager.importDatabase(buffer);
        window.location = 'index.html?back=yes';
    }
}
