/**
 * Centralized mock/demo video URLs — served from Firebase Storage in prod.
 *
 * All paths below were uploaded once via scripts/upload-mock-videos.js.
 * Local files in public/ are kept as source material; they are excluded
 * from the production build (see vite.config.js excludedPublicPatterns).
 *
 * Firebase Storage bucket: vuvio-bf328.firebasestorage.app
 */

// GCS public URL — bypasses Firebase Security Rules, uses object-level publicRead ACL set at upload
const STORAGE_BASE = 'https://storage.googleapis.com/vuvio-bf328.firebasestorage.app/';

function fb(path) {
  return `${STORAGE_BASE}${path}`;
}

// ── live-mockup loops (16 short clips used on the globe / explore feed) ──────
export const MOCK_VIDEO_URLS = {
  liveLoop1:  fb('mock-videos/live-mockups/mockup_1.mp4'),
  liveLoop2:  fb('mock-videos/live-mockups/mockup_2.mp4'),
  liveLoop3:  fb('mock-videos/live-mockups/mockup_3.mp4'),
  liveLoop4:  fb('mock-videos/live-mockups/mockup_4.mp4'),
  liveLoop5:  fb('mock-videos/live-mockups/mockup_5.mp4'),
  liveLoop6:  fb('mock-videos/live-mockups/mockup_6.mp4'),
  liveLoop7:  fb('mock-videos/live-mockups/mockup_7.mp4'),
  liveLoop8:  fb('mock-videos/live-mockups/mockup_8.mp4'),
  liveLoop9:  fb('mock-videos/live-mockups/mockup_9.mp4'),
  liveLoop10: fb('mock-videos/live-mockups/mockup_10.mp4'),
  liveLoop11: fb('mock-videos/live-mockups/mockup_11.mp4'),
  liveLoop12: fb('mock-videos/live-mockups/mockup_12.mp4'),
  liveLoop13: fb('mock-videos/live-mockups/mockup_13.mp4'),
  liveLoop14: fb('mock-videos/live-mockups/mockup_14.mp4'),
  liveLoop15: fb('mock-videos/live-mockups/mockup_15.mp4'),
  liveLoop16: fb('mock-videos/live-mockups/mockup_16.mp4'),

  // ── full-length demo streams ────────────────────────────────────────────────
  biking:      fb('mock-videos/videos/biking.mp4'),
  chefParis:   fb('mock-videos/videos/chef-paris.mp4'),
  pexels1:     fb('mock-videos/videos/11963745-uhd_2160_3840_60fps.mp4'),
  pexels2:     fb('mock-videos/videos/12130364_2160_3840_30fps.mp4'),
  pexels3:     fb('mock-videos/videos/12339859_2160_3840_60fps.mp4'),
  pexels4:     fb('mock-videos/videos/15794531_1440_2560_24fps.mp4'),
  pexels5:     fb('mock-videos/videos/16232606_2160_3840_30fps.mp4'),
  pexels6:     fb('mock-videos/videos/16317498_2160_3840_30fps.mp4'),
  pexels7:     fb('mock-videos/videos/16352747_1080_1920_30fps.mp4'),
  pexels8:     fb('mock-videos/videos/20667540-uhd_2160_3840_60fps.mp4'),
  pexels9:     fb('mock-videos/videos/8678453-hd_1080_1920_30fps.mp4'),
  wingsuit:    fb('mock-videos/videos/mockups/JoHannes_Wingsuit__My_Most_Brutal_Wingsuit_Flight_Ever_Taschhorn_4491m_Swiss__QKMkhCsgsas__clip.mp4'),
  serrasolses: fb('mock-videos/videos/mockups/Serrasolses_Brothers__Rio_Claro_100%_GoPro_2022__HDs84SRy7i0__clip.mp4'),

  // ── music POV streams ─────────────────────────────────────────────────────
  guitar:        fb('mock-videos/videos/guitar.mp4'),
  drummer:       fb('mock-videos/videos/drummer.mp4'),
  piano:         fb('mock-videos/videos/piano.mp4'),
  feuchaterton:      fb('mock-videos/videos/feuchaterton.mp4'),
  guitarThumb:       fb('mock-videos/videos/guitar-thumb.jpg'),
  drummerThumb:      fb('mock-videos/videos/drummer-thumb.jpg'),
  pianoThumb:        fb('mock-videos/videos/piano-thumb.jpg'),
  feuchatertonThumb: fb('mock-videos/videos/feuchaterton-thumb.jpg'),
};

// ── thumbnails / cover images ──────────────────────────────────────────────────
export const MOCK_THUMBNAILS = {
  liveLoop1:  fb('mock-videos/live-mockups/mockup_1-thumb.jpg'),
  liveLoop2:  fb('mock-videos/live-mockups/mockup_2-thumb.jpg'),
  liveLoop3:  fb('mock-videos/live-mockups/mockup_3-thumb.jpg'),
  liveLoop4:  fb('mock-videos/live-mockups/mockup_4-thumb.jpg'),
  liveLoop5:  fb('mock-videos/live-mockups/mockup_5-thumb.jpg'),
  liveLoop6:  fb('mock-videos/live-mockups/mockup_6-thumb.jpg'),
  liveLoop7:  fb('mock-videos/live-mockups/mockup_7-thumb.jpg'),
  liveLoop8:  fb('mock-videos/live-mockups/mockup_8-thumb.jpg'),
  liveLoop9:  fb('mock-videos/live-mockups/mockup_9-thumb.jpg'),
  liveLoop10: fb('mock-videos/live-mockups/mockup_10-thumb.jpg'),
  liveLoop11: fb('mock-videos/live-mockups/mockup_11-thumb.jpg'),
  liveLoop12: fb('mock-videos/live-mockups/mockup_12-thumb.jpg'),
  liveLoop13: fb('mock-videos/live-mockups/mockup_13-thumb.jpg'),
  liveLoop14: fb('mock-videos/live-mockups/mockup_14-thumb.jpg'),
  liveLoop15: fb('mock-videos/live-mockups/mockup_15-thumb.jpg'),
  liveLoop16: fb('mock-videos/live-mockups/mockup_16-thumb.jpg'),

  biking:    fb('mock-videos/videos/biking-cover.jpg'),
  pexels1:   fb('mock-videos/videos/11963745-uhd_2160_3840_60fps-cover.jpg'),
  pexels2:   fb('mock-videos/videos/12130364_2160_3840_30fps-cover.jpg'),
  pexels3:   fb('mock-videos/videos/12339859_2160_3840_60fps-cover.jpg'),
  pexels4:   fb('mock-videos/videos/15794531_1440_2560_24fps-cover.jpg'),
  pexels5:   fb('mock-videos/videos/16232606_2160_3840_30fps-cover.jpg'),
  pexels6:   fb('mock-videos/videos/16317498_2160_3840_30fps-cover.jpg'),
  pexels7:   fb('mock-videos/videos/16352747_1080_1920_30fps-cover.jpg'),
  pexels8:   fb('mock-videos/videos/20667540-uhd_2160_3840_60fps-cover.jpg'),
  pexels9:   fb('mock-videos/videos/8678453-hd_1080_1920_30fps-cover.jpg'),
};
