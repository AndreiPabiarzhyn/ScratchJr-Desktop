// Browser-only replacement for src/electronClient.js (ElectronDesktopInterface).
// Installed as window.tablet, same method surface, so src/app/src/iPad/iOS.js
// needs no changes beyond picking this up via waitForInterface(). Not
// installed until the sql.js/IndexedDB database is ready (see bottom of
// file) - iOS.waitForInterface already polls for window.tablet, so callers
// need no changes for this async startup.

import createWebDatabaseManager from './webDb.js';

// snapsvg's dist/snap.svg.js (imported by painteditor/Ghost.js) assigns to a
// bare, undeclared `eve` as an implicit global - fine under Node's non-strict
// CJS wrapper (how electron-compile ran it), a ReferenceError under strict-
// mode ES modules (how Vite runs it). Pre-declaring the global here (this
// module is the first thing appEntry.js imports) makes it a reassignment
// instead of an undeclared-variable assignment, which strict mode allows.
globalThis.eve = undefined;

class WebTabletInterface {
    constructor (dbManager) {
        this.currentAudio = {};
        this.mediaCache = {};
        this.dbManager = dbManager;
    }

    // sql.js (WASM) + IndexedDB persistence - see src/app/src/webDb.js
    database_stmt (json) {
        return this.dbManager.stmt(json);
    }

    database_query (json) {
        return JSON.stringify(this.dbManager.query(json));
    }

    io_getsettings () { // eslint-disable-line class-methods-use-this
        return 'web,false,YES,YES';
    }

    // M4: PROJECTFILES-backed media storage, mirroring src/main.js's
    // io_getmedia/io_getmediadata/io_getmedialen/io_getmediadone chunked-read
    // protocol (see src/app/src/iPad/iOS.js's processdata loop, which calls
    // getmedialen once then getmediadata in <=100000-char chunks).
    io_getmedia (file) {
        return this.dbManager.readProjectFile(file);
    }

    io_getmedialen (file, key) {
        const encoded = this.dbManager.readProjectFile(file);
        this.mediaCache[key] = encoded;
        return encoded ? encoded.length : 0;
    }

    io_getmediadata (key, offset, length) {
        const mediaString = this.mediaCache[key];
        return mediaString ? mediaString.substring(offset, offset + length) : null;
    }

    io_getmediadone (key) {
        delete this.mediaCache[key];
        return true;
    }

    io_setmedia (str, ext) {
        const filename = `${this.dbManager.getMD5(str)}.${ext}`;
        return this.dbManager.saveToProjectFiles(filename, str) ? filename : -1;
    }

    io_setmedianame (str, name, ext) {
        const filename = `${name}.${ext}`;
        return this.dbManager.saveToProjectFiles(filename, str) ? filename : -1;
    }

    io_getmd5 (str) {
        return str ? this.dbManager.getMD5(str) : null;
    }

    io_remove (str) {
        this.dbManager.removeProjectFile(str);
        return true;
    }

    io_cleanassets (str) {
        this.dbManager.cleanProjectFiles(str);
        return true;
    }

    // Static UI/sample sounds (src/app/sounds, src/app/samples) are plain
    // fetches; user-recorded/project sounds live in PROJECTFILES (already a
    // full data: URI, per recordsound_recordclose()'s readAsDataURL below) -
    // mirrors io_getAudioData's "app dir first, then DB" lookup in main.js.
    async io_registersound (dir, name) {
        if (this.currentAudio[name]) return;
        let dataUri = await WebTabletInterface.fetchStaticAudioDataUri(name);
        if (!dataUri) dataUri = this.dbManager.readProjectFile(name);
        this.loadSoundFromDataURI(name, dataUri);
    }

    static async fetchStaticAudioDataUri (name) {
        for (const path of [`sounds/${name}`, `samples/${name}`]) {
            const res = await fetch(path);
            if (!res.ok) continue;
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }
        return null;
    }

    io_getfile (str) {
        return this.dbManager.readProjectFile(str);
    }

    io_setfile (name, btoaStr) {
        return this.dbManager.saveToProjectFiles(name, btoaStr) ? name : -1;
    }

    // -- Real implementation: static resources are just same-origin fetches
    io_gettextresource (filename) { // eslint-disable-line class-methods-use-this
        const xhr = new XMLHttpRequest();
        xhr.open('GET', filename, false);
        xhr.send();
        return xhr.responseText;
    }

    // -- Trivial, matches ElectronDesktopInterface exactly
    askForPermission () { // eslint-disable-line class-methods-use-this
        return true;
    }

    hideSplash () { // eslint-disable-line class-methods-use-this
        return true;
    }

    deviceName () { // eslint-disable-line class-methods-use-this
        return 'web';
    }

    analyticsEvent () {} // eslint-disable-line class-methods-use-this

    // -- Camera: already pure browser API (getUserMedia/<canvas>), same as desktop
    scratchjr_stopfeed () {
        if (this.cameraPickerDialog) {
            this.cameraPickerDialog.hide();
            this.cameraPickerDialog = null;
        }
    }

    scratchjr_choosecamera () {} // eslint-disable-line class-methods-use-this

    scratchjr_captureimage () {
        if (this.cameraPickerDialog) {
            const imgData = this.cameraPickerDialog.snapshot();
            if (imgData) {
                const base64resultNoDataPrefix = imgData.split(',')[1];
                Camera.processimage(base64resultNoDataPrefix); // eslint-disable-line no-undef
            }
        }
    }

    scratchjr_cameracheck () { // eslint-disable-line class-methods-use-this
        return true;
    }

    scratchjr_startfeed (str) {
        const data = JSON.parse(str);
        if (!this.cameraPickerDialog) {
            this.cameraPickerDialog = new CameraPickerDialog(data);
            this.cameraPickerDialog.show();
        }
    }

    loadSoundFromDataURI (name, dataUri) {
        if (dataUri && name) {
            const audio = new window.Audio(dataUri);
            audio.volume = 0.8;
            audio.onended = () => {
                iOS.soundDone(name); // eslint-disable-line no-undef
            };
            this.currentAudio[name] = audio;
        }
    }

    // -- Audio: already pure browser API (getUserMedia/MediaRecorder), same as desktop
    getAudioCaptureElement () {
        if (!this.audioCaptureElement) {
            this.audioCaptureElement = new AudioCapture();
            this.audioCaptureElement.isRecordingPermitted = true;
        }
        return this.audioCaptureElement;
    }

    io_playsound (name) {
        const audioElement = this.currentAudio[name];
        if (!audioElement) {
            setTimeout(() => {
                iOS.soundDone(name); // eslint-disable-line no-undef
            }, 1);
            return;
        }
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    }

    io_stopsound (name) {
        const audioElement = this.currentAudio[name];
        if (audioElement) {
            audioElement.pause();
        }
    }

    recordsound_recordstart () {
        return this.getAudioCaptureElement().startRecord();
    }

    recordsound_recordstop () {
        this.getAudioCaptureElement().stopRecord();
    }

    recordsound_volume () {
        return this.getAudioCaptureElement().getVolume();
    }

    recordsound_recordclose (keep) {
        const audioCaptureElement = this.getAudioCaptureElement();
        if (keep === 'YES') {
            const blob = audioCaptureElement.captureRecordingAsBlob();
            if (blob) {
                const filename = audioCaptureElement.getId();
                const fileReader = new FileReader();
                fileReader.onload = () => {
                    this.io_setmedianame(fileReader.result, filename, 'webm');
                    this.loadSoundFromDataURI(`${filename}.webm`, fileReader.result);
                };
                fileReader.readAsDataURL(blob);
            }
        }
    }

    recordsound_startplay () {
        this.getAudioCaptureElement().startPlay();
    }

    recordsound_stopplay () {
        this.getAudioCaptureElement().stopPlay();
    }
}

class AudioCapture {
    constructor () {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    getId (isNewRecording) {
        if (isNewRecording || !this.id) {
            this.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        return this.id;
    }

    startRecord (constraints) {
        this.savedBlob = null;
        constraints = constraints || {audio: true};
        if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints).then(
                this.beginStartRecord.bind(this),
                this.onError.bind(this)
            );
        }
        return `${this.getId(true)}.webm`;
    }

    beginStartRecord (stream) {
        if (!this.isRecordingPermitted) {
            throw new Error('Recording audio is turned off');
        }
        this.chunks = null;
        this.currentStream = stream;
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.ondataavailable = this.onRecordData.bind(this);
        this.mediaRecorder.start();
    }

    onError () {}

    onRecordData (e) {
        if (!this.chunks) {
            this.chunks = [];
        }
        this.chunks.push(e.data);
    }

    captureRecordingAsBlob () {
        if (this.savedBlob) return this.savedBlob;
        try {
            if (!this.chunks || this.chunks.length === 0) {
                if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                    this.mediaRecorder.requestData();
                }
            }
            if (!this.chunks) return null;
            const blob = new Blob(this.chunks, {type: 'audio/ogg; codecs=opus'});
            this.chunks = [];
            this.audioElement = this.audioElement || new window.Audio();
            this.audioElement.srcObject = this.currentStream;
            this.savedBlob = blob;
            return this.savedBlob;
        } catch (e) {
            this.savedBlob = null;
            return null;
        }
    }

    stopRecord () {
        this.stopAudioMeter();
        if (this.mediaRecorder) {
            this.mediaRecorder.requestData();
            this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;
    }

    stopPlay () {
        if (this.audioPlaybackElement) {
            this.audioPlaybackElement.pause();
            this.audioPlaybackElement = null;
        }
    }

    startPlay () {
        if (this.mediaRecorder) {
            this.stopRecord();
        }
        const blob = this.captureRecordingAsBlob();
        if (blob) {
            const fileReader = new FileReader();
            fileReader.onload = () => {
                this.audioPlaybackElement = new window.Audio(fileReader.result);
                this.audioPlaybackElement.volume = 0.8;
                this.tryPlayAudio(this.audioPlaybackElement);
            };
            fileReader.readAsDataURL(blob);
        }
    }

    tryPlayAudio (audioElement) { // eslint-disable-line class-methods-use-this
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    }

    getVolume () {
        if (this.isDisconnected) return 0;
        if (!this.audioProcessor && this.currentStream) {
            this.startAudioMeter();
        }
        return this.audioProcessor ? this.audioProcessor.volume : 0;
    }

    startAudioMeter () {
        if (!this.currentStream) return;
        if (!this.mediaStreamSource) {
            this.mediaStreamSource = this.audioCtx.createMediaStreamSource(this.currentStream);
        }
        if (!this.audioProcessor) {
            const processor = this.audioCtx.createScriptProcessor(null, 1, 1);
            processor.volume = 0;
            processor.connect(this.audioCtx.destination);
            processor.onaudioprocess = this.processVolume.bind(this);
            processor.shutdown = () => {
                processor.disconnect();
                processor.onaudioprocess = null;
            };
            this.audioProcessor = processor;
            this.mediaStreamSource.connect(this.audioProcessor);
        }
    }

    stopAudioMeter () {
        if (this.audioProcessor) {
            this.audioProcessor.shutdown();
            this.mediaStreamSource.disconnect(this.audioProcessor);
            this.audioProcessor = null;
        }
        this.mediaStreamSource = null;
    }

    processVolume (event) {
        const buf = event.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
            sum += Math.abs(buf[i]);
        }
        const avg = Math.sqrt(sum / buf.length);
        this.audioProcessor.volume = avg / 0.5;
    }
}

class VideoCapture {
    constructor (videoElement) {
        this.videoElement = videoElement || document.createElement('video');
    }

    startRecord (constraints) {
        constraints = constraints || {video: true, audio: false};
        if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints).then(
                this.beginStartRecord.bind(this),
                this.onError.bind(this)
            );
        }
    }

    stopRecord () {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach((track) => track.stop());
            this.videoElement.pause();
            this.videoElement.src = null;
        }
    }

    beginStartRecord (stream) {
        this.videoElement.src = window.URL.createObjectURL(stream);
        this.currentStream = stream;
        if (!this.isRecordingPermitted) {
            this.stopRecord();
            throw new Error('Recording video is not permitted.');
        }
    }

    onError () {
        if (!this.inOnError) {
            try {
                this.inOnError = true;
                this.stopRecord();
            } finally {
                this.inOnError = false;
            }
        }
    }

    /** takes a picture of the current video feed and returns a data: url in png format */
    snapshot (cameraRect, isMirrored) {
        if (!this.currentStream || !this.isRecordingPermitted) return null;
        const canvas = document.createElement('canvas');
        canvas.width = cameraRect.width;
        canvas.height = cameraRect.height;
        const ctx = canvas.getContext('2d');
        if (isMirrored) {
            ctx.translate(cameraRect.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(this.videoElement, 0, 0, cameraRect.width, cameraRect.height);
        return canvas.toDataURL('image/png');
    }
}

class CameraPickerDialog {
    constructor (data) {
        this.shapeData = data;
        this.isMirrored = true;
    }

    show () {
        if (this.cameraPickerDiv) return;
        this.cameraPickerDiv = document.createElement('div');
        this.cameraPickerDiv.setAttribute('style', 'z-index:90000; position:absolute; top:0px, left:0px, width: 1000px; height: 1000px;');
        this.cameraPickerDiv.id = 'cameraPickerDiv';
        const videoStyle = this.isMirrored
            ? `style='-moz-transform: scale(-1, 1); -webkit-transform: scale(-1, 1); -o-transform: scale(-1, 1); transform: scale(-1, 1); filter: FlipH;'`
            : '';
        this.cameraPickerDiv.innerHTML = `
           <video id='CameraPickerDialog-cameraFeed' ${videoStyle} autoplay></video>
           <img id='CameraPickerDialog-maskImg' src='${this.shapeData.image}'></img>`;
        document.getElementById('backdrop').appendChild(this.cameraPickerDiv);

        this.videoElement = document.getElementById('CameraPickerDialog-cameraFeed');
        this.maskImg = document.getElementById('CameraPickerDialog-maskImg');

        this.layoutDiv(this.videoElement, this.shapeData.x, this.shapeData.y, this.shapeData.width, this.shapeData.height);
        this.layoutDiv(this.maskImg, this.shapeData.mx, this.shapeData.my, this.shapeData.mw, this.shapeData.mh);

        this.videoCaptureElement = new VideoCapture(this.videoElement);
        this.videoCaptureElement.isRecordingPermitted = true;
        this.videoCaptureElement.startRecord({video: {width: this.shapeData.width, height: this.shapeData.height}});
    }

    layoutDiv (el, x, y, w, h) { // eslint-disable-line class-methods-use-this
        el.style.position = 'absolute';
        el.style.top = `${y}px`;
        el.style.left = `${x}px`;
        if (w) el.style.width = `${w}px`;
        if (h) el.style.height = `${h}px`;
    }

    snapshot () {
        if (!this.videoCaptureElement) return null;
        const cameraRect = {x: 0, y: 0, width: this.shapeData.width, height: this.shapeData.height};
        return this.videoCaptureElement.snapshot(cameraRect, this.isMirrored);
    }

    hide () {
        if (this.videoCaptureElement) {
            this.videoCaptureElement.stopRecord();
            this.videoCaptureElement = null;
            this.cameraPickerDiv.remove();
            this.cameraPickerDiv = null;
            this.videoElement = null;
        }
    }
}

if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
}

createWebDatabaseManager().then((dbManager) => {
    window.tablet = new WebTabletInterface(dbManager);
});
