// Browser-only ScratchJr database engine: same sql.js schema/queries as
// src/main.js's DatabaseManager, persisted to IndexedDB instead of a file
// on disk. Used by webClient.js (M2/M3 of the web port, see PLAN.md).

import initSqlJs from 'sql.js/dist/sql-wasm.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import md5 from 'js-md5';

const IDB_NAME = 'scratchjr';
const IDB_STORE = 'kv';
const IDB_KEY = 'sqlite-db';

function openIdb () {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet (key) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbPut (key, value) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

class WebDatabaseManager {
    constructor (SQL) {
        this.SQL = SQL;
        this.saveTimer = null;
    }

    async open (existingBytes) {
        if (existingBytes) {
            this.db = new this.SQL.Database(new Uint8Array(existingBytes));
        } else {
            this.initTables();
            await this.seedFirstRun();
        }
        await this.save();
    }

    initTables () {
        this.db = new this.SQL.Database();
        this.db.exec('CREATE TABLE IF NOT EXISTS PROJECTS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MTIME DATETIME, ALTMD5 TEXT, POS INTEGER, NAME TEXT, JSON TEXT, THUMBNAIL TEXT, OWNER TEXT, GALLERY TEXT, DELETED TEXT, VERSION TEXT, ISGIFT INTEGER DEFAULT 0)\n');
        this.db.exec('CREATE TABLE IF NOT EXISTS USERSHAPES (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, NAME TEXT, OWNER TEXT, SCALE TEXT, VERSION TEXT)\n');
        this.db.exec('CREATE TABLE IF NOT EXISTS USERBKGS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, OWNER TEXT, VERSION TEXT)\n');
        this.db.exec('CREATE TABLE IF NOT EXISTS PROJECTFILES (MD5 TEXT PRIMARY KEY, CONTENTS TEXT)\n');
    }

    // M2: seed one real sample project (fetched from src/app/samples/Bump.txt,
    // the same file the samples gallery already uses) as a "My Stuff" entry
    // in PROJECTS (gallery=NULL, unlike the samples-gallery copy), so there
    // is something to open on first run.
    async seedFirstRun () {
        const res = await fetch('samples/Bump.txt');
        const [p] = await res.json();
        // The gallery copy's thumbnail.md5 is a direct static path
        // ("samples/Bump.png"), which Samples.js reads with a plain <img>
        // src assignment. A "My Stuff" entry (gallery=NULL) instead goes
        // through Home.js -> IO.getAsset, which expects a PROJECTFILES MD5
        // key, not a static path - strip the prefix so that (currently
        // stubbed, see M4) code path is exercised the way it will be for
        // real user projects, instead of the samples-gallery path.
        const thumbnail = {...p.thumbnail, md5: p.thumbnail.md5.replace('samples/', '')};
        this.db.run(
            'insert into PROJECTS (name, version, deleted, mtime, isgift, json, thumbnail, gallery) values (?,?,?,?,?,?,?,NULL)',
            [p.name, p.version, p.deleted, Date.now().toString(), '0', JSON.stringify(p.json), JSON.stringify(thumbnail)]
        );
    }

    // Mirrors DatabaseManager.stmt in src/main.js exactly (same sql.js API).
    stmt (jsonStrOrJsonObj) {
        try {
            const json = (typeof jsonStrOrJsonObj === 'string') ? JSON.parse(jsonStrOrJsonObj) : jsonStrOrJsonObj || {};
            const statement = this.db.prepare(json.stmt, json.values);
            while (statement.step()) statement.get();
            statement.free();
            const result = this.db.exec('select last_insert_rowid();');
            const lastRowId = result[0].values[0][0];
            this.scheduleSave();
            return lastRowId;
        } catch (e) {
            return -1;
        }
    }

    // Mirrors DatabaseManager.query in src/main.js exactly (same sql.js API).
    query (jsonStrOrJsonObj) {
        try {
            const json = (typeof jsonStrOrJsonObj === 'string') ? JSON.parse(jsonStrOrJsonObj) : jsonStrOrJsonObj || {};
            const statement = this.db.prepare(json.stmt, json.values);
            const rows = [];
            while (statement.step()) {
                rows.push(statement.getAsObject());
            }
            statement.free();
            return rows;
        } catch (e) {
            return [];
        }
    }

    // M4: file/media storage, mirroring ScratchJRDataStore/DatabaseManager's
    // PROJECTFILES-table methods in src/main.js (readProjectFile,
    // saveToProjectFiles, removeProjectFile, getMD5, cleanProjectFiles).
    getMD5 (data) {
        return md5(data); // eslint-disable-line new-cap
    }

    readProjectFile (fileMD5) {
        const rows = this.query({stmt: 'select CONTENTS from PROJECTFILES where MD5 = ?', values: [fileMD5]});
        return rows.length > 0 ? rows[0].CONTENTS : null;
    }

    saveToProjectFiles (fileMD5, content) {
        try {
            this.db.run('insert or replace into PROJECTFILES (MD5, CONTENTS) values (?,?)', [fileMD5, content]);
            this.scheduleSave();
            return true;
        } catch (e) {
            return false;
        }
    }

    removeProjectFile (fileMD5) {
        this.db.run('delete from PROJECTFILES where MD5 = ?', [fileMD5]);
        this.scheduleSave();
    }

    cleanProjectFiles (fileType) {
        if (fileType === 'wav') fileType = 'webm';
        const unused = this.query({stmt: `select MD5 from PROJECTFILES where MD5 LIKE ?`, values: [`%.${fileType}`]});
        unused.forEach(({MD5: candidate}) => {
            if (!candidate) return;
            const inProject = this.query({stmt: 'select ID from PROJECTS where JSON like ?', values: [`%${candidate}%`]});
            if (inProject.length > 0) return;
            const inShapes = this.query({stmt: 'select MD5 from USERSHAPES where MD5 = ?', values: [candidate]});
            if (inShapes.length > 0) return;
            const inBkgs = this.query({stmt: 'select MD5 from USERBKGS where MD5 = ?', values: [candidate]});
            if (inBkgs.length > 0) return;
            this.removeProjectFile(candidate);
        });
    }

    scheduleSave () {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.save(), 800);
    }

    async save () {
        await idbPut(IDB_KEY, this.db.export());
    }

    // M6: manual backup/restore, since there's no filesystem safety net for
    // an IndexedDB-only store (cleared cache/browser reinstall = data gone).
    exportDatabase () {
        return this.db.export();
    }

    async importDatabase (bytes) {
        this.db = new this.SQL.Database(new Uint8Array(bytes));
        await this.save();
    }
}

export default async function createWebDatabaseManager () {
    const SQL = await initSqlJs({locateFile: () => sqlWasmUrl});
    const manager = new WebDatabaseManager(SQL);
    const existingBytes = await idbGet(IDB_KEY);
    await manager.open(existingBytes);
    return manager;
}
