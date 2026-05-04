export const FFMPEG_COMMAND = {
    HIDE_BANNER: '-hide_banner',
    OVERWRITE_OUTPUT: '-y',
    AVOID_NEGATIVE_TIMESTAMPS: ['-avoid_negative_ts', 'make_zero'],
    // keep the frame rate constant - The video plays with the same number of frames every second from start to end
    CONSTANT_FRAME_RATE: ['-vsync', 'cfr'],
    COPY: ['-c', 'copy'],
    // tell FFmpeg to use the audio stream from the input explicitly
    EXPLICIT_AUDIO_STREAM: '0:a:0',
    EXPLICIT_VIDEO_STREAM: '0:v:0',
    // tells FFmpeg to encode audio using the AAC codec
    AAC_AUDIO_CODEC: 'aac',
    // Encode the audio at 192 kilobits per second (kbps).
    AUDIO_BITRATE: '192k',
    AUDIO_FREQUENCY: 44100,
    // encode the video using the H.264 standard
    H264_VIDEO_CODEC: 'libx264',
    FORMAT_YUV420P: 'format=yuv420p',
    // Move the MP4 metadata to the beginning of the file so video can start playing before it fully downloads
    MOVE_METADATA_TO_BEGINNING: ['-movflags', '+faststart'],
    ALLOW_MULTIPLE_PATHS: ['-safe', '0'],
    CONCAT_FORMAT: ['-f', 'concat'],
    CONCAT_SAFE_0: ['-f', 'concat', '-safe', '0'],
    // Fragmented MP4 for pipe/output stability
    MOVFLAGS_FRAG_FASTSTART: ['-movflags', '+frag_keyframe+empty_moov+faststart'],
    // Generate missing or broken presentation timestamps (PTS) for the input stream.
    GENERATE_MISSING_PTS: ['-fflags', '+genpts'],
    // Treat the input as a libavfilter input, not as file. use this when need to generate silent audio
    TREAT_AS_LIBAV_FILTER: ['-f', 'lavfi'],
    // Generate a silent audio stream with the specified channel layout and sample rate.
    NULL_AUDIO_STREAM: ['anullsrc=channel_layout=stereo:sample_rate=44100'],
    LOOP_INDEFINITE: ['-loop', '1'],
    // Output the shortest input stream.
    OUTPUT_SHORTEST_STREAM: ['-shortest'],
}