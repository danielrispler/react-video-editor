# HLS preview conversion test plan

Future backend MPD-to-HLS preview tests should cover:

1. Parse `SegmentTemplate` values from `sample.mpd`.
2. Derive segment duration as `duration / timescale = 15` seconds.
3. Generate an HLS VOD playlist matching `expected.m3u8`, including `EXT-X-MAP`.
4. Preserve existing `.m4s` segment URLs and initialization MP4; do not transcode to MP4.
5. Calculate `sourceOffsetMs` when the requested start lands inside the first segment.
6. Reject invalid ranges where `endTimeMs <= startTimeMs`.
7. Reject excessive duration when a max-duration guard exists.
