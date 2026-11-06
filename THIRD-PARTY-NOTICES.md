# Upstream sources and modifications

This package converts the YouTube Plus module from https://github.com/gogrhw/surge for Egern's native scripting interface. Attribution in the original module is retained: gogrhw, Maasea, Aioneas, QingRex, VirgilClyne. Upstream snapshots and SHA-256 hashes are included.

DualSubs/YouTube and DualSubs/Universal publish their source under Apache-2.0. Copies of their license texts are in `licenses/`. Their original project links remain in the corresponding JavaScript sources. Licenses were retrieved on 2026-11-06.

No repository-wide LICENSE or NOTICE was found at the root of gogrhw/surge during this inspection. The full provenance and licensing of modifications made in that repository, and all bundled third-party libraries, have not been established. Including Apache-2.0 text for DualSubs does not relicense unrelated portions or prove a blanket license for this package. Do not interpret this notice as a new license grant from upstream authors.

Conversion modifications are documented in `README.zh-TW.md` and implemented in `bridge.js` / `build.py`: native context API adapter, sequential processing of overlapping rules, local Database declaration for ES module strict mode, corrected Music subtype URL assignment, disabled malformed upstream redirect, explicit body size and execution limits, and GitHub-hosted resource URLs when configured. Original snapshot files are unchanged; the generated `youtube-plus.native.js` combines and adapts them.
