## Official disclaimer
Scratch and ScratchJr are trademarks of Massachusetts Institute of Technology, which does not sponsor, endorse, or authorize this content. See scratchjr.org for more information.

## Play it
Once deployed (see "Building" below), this runs as a website - no download needed.


## The geeky stuff

This repository contains a port of ScratchJr to the web: a static site that
runs entirely in the browser, with no backend and no install step.

It has been ported with love from the iPad / Android editions (by way of an
earlier Electron desktop port) as an independent, open source community
project.

If you are looking for the Official ScratchJr build from MIT for Android and iPad, visit
the LLK/ScratchJr (https://github.com/LLK/scratchjr) repository.

## Architecture Overview

* The HTML5 side of ScratchJr is very close to the original iOS / Android versions.
* Minor changes were made to the CSS stylesheets to support resizing.
* Touch events were translated to mouse events.
* [PLAN.md](PLAN.md) has the full history and rationale of the web port.

## WebTabletInterface as a third tabletInterface

The original html implementation called out to a tabletInterface to make calls to
the host platform (Android / iOS) for storage and audio/video recording.

`WebTabletInterface` (`src/app/src/webClient.js`) implements this for the
browser: audio/video recording use the HTML5 WebRTC APIs directly, and
storage goes through `src/app/src/webDb.js` - a `sql.js` (WASM) database
persisted to IndexedDB.

## Sql.js

The database is largely the same format as the original iOS / Android version, but it adds
a third table called PROJECTFILES. Instead of writing individual svg, video, and audio files out to
a filesystem, they are all stored within the PROJECTFILES table - this also means the whole
library (projects + media) is one sqlite file, which can be exported/imported as a backup
(see the "Backup" section of the settings screen, or the buttons in the editor).

## Building

You will need node.js installed. (https://nodejs.org/en/)
Also git (which you may already have).

* <tt>npm install</tt>
* <tt>npm run dev</tt> - starts a local dev server (Vite) with hot reload
* <tt>npm run build</tt> - builds the static site into <tt>dist/</tt>
* <tt>npm run preview</tt> - serves the built <tt>dist/</tt> locally

Pushes to <tt>master</tt> deploy <tt>dist/</tt> to GitHub Pages automatically
(<tt>.github/workflows/deploy.yml</tt>).

## Running lint

We use eslint to verify the install.  Our configuration is similar to airbnb, however 
several style rules had to be adapted to avoid changing the original scratch sources.

* <tt>npm run lint</tt>

## Debugging

<tt>npm run dev</tt> and open the printed localhost URL - use your browser's
own devtools for everything (console, storage/IndexedDB inspector, network).

## Directory Structure and Projects
This repository has the following directory structure:

* <tt>package.json</tt> - Contains eslint rules, modules used, and build scripts
* <tt>vite.config.js</tt> - Build configuration (multi-page app: index/home/editor/gettingstarted)
* <tt>src/app/</tt> - The application: HTML entry pages, <tt>src/</tt> (editor/lobby/painteditor/etc, shared with the original iOS/Android/Electron versions), <tt>public/</tt> (static assets served as-is)
* <tt>docs/</tt> - Developer Documentation


## Acknowledgments

Thank you to the official Scratch team and their supporters.  Their contributions are listed here:
https://github.com/LLK/scratchjr

In addition, thank you to the folks working on Sql.js and Vite.


## Disclaimers

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


For more information, see [CONTRIBUTING.md](CONTRIBUTING.md).

